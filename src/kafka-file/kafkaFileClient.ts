import * as vscode from "vscode";
import { ConsumerCollection, ConsumerCollectionChangedEvent, ConsumerLaunchState } from "../client/consumer";
import { ProducerCollection, ProducerCollectionChangedEvent, ProducerLaunchState } from "../client/producer";
import { ClusterSettings } from "../settings/clusters";

import { getLanguageModelCache, LanguageModelCache } from './languageModelCache';
import { KafkaFileDocument } from "./languageservice/parser/kafkaFileParser";
import { ConsumerLaunchStateProvider, getLanguageService, LanguageService, ProducerLaunchStateProvider, SelectedClusterProvider, TopicDetail, TopicProvider } from "./languageservice/kafkaFileLanguageService";
import { runSafeAsync } from "./utils/runner";
import { KafkaExplorer, TopicItem } from "../explorer";

export function startLanguageClient(
    clusterSettings: ClusterSettings,
    producerCollection: ProducerCollection,
    consumerCollection: ConsumerCollection,
    explorer: KafkaExplorer,
    context: vscode.ExtensionContext
): vscode.Disposable {

    // Create cache for opened text document and AST
    const openedDocuments = new Map<string, vscode.TextDocument>();
    const kafkaFileDocuments = getLanguageModelCache<KafkaFileDocument>(10, 60, document => languageService.parseKafkaFileDocument(document));

    // Create the Kafka file language service.
    const languageService = createLanguageService(clusterSettings, producerCollection, consumerCollection, explorer);

    // Open / Close document
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(e => {
        if (e.languageId === 'kafka') {
            openedDocuments.set(e.uri.toString(), e);
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(e => {
        if (e.languageId === 'kafka') {
            openedDocuments.delete(e.uri.toString());
            kafkaFileDocuments.onDocumentRemoved(e);
        }
    }));

    const documentSelector = [
        { language: "kafka", scheme: "file" },
        { language: "kafka", scheme: "untitled" },
        { language: "kafka", scheme: "kafka" },
    ];

    // Code Lenses
    const codeLensProvider = new KafkaFileCodeLensProvider(kafkaFileDocuments, languageService);
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(documentSelector, codeLensProvider));

    // Refresh the code lenses when:
    // 1. a consumer is started / stopped to refresh the status of each declared CONSUMER
    context.subscriptions.push(consumerCollection.onDidChangeCollection((e: ConsumerCollectionChangedEvent) => {
        codeLensProvider.refresh();
    }));
    // 2. a producer is started / stopped to refresh the status of each declared PRODUCER
    context.subscriptions.push(producerCollection.onDidChangeCollection((e: ProducerCollectionChangedEvent) => {
        codeLensProvider.refresh();
    }));
    // 3. a cluster is selected
    clusterSettings.onDidChangeSelected((e) => {
        codeLensProvider.refresh();
    });

    // Completion
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(documentSelector,
            new KafkaFileCompletionItemProvider(kafkaFileDocuments, languageService),
            ':', '{', '.'));

    return {
        dispose() {
            kafkaFileDocuments.dispose();
        }
    };
}

function createLanguageService(clusterSettings: ClusterSettings, producerCollection: ProducerCollection, consumerCollection: ConsumerCollection, explorer: KafkaExplorer): LanguageService {
    const producerLaunchStateProvider = {
        getProducerLaunchState(uri: vscode.Uri): ProducerLaunchState {
            const producer = producerCollection.get(uri);
            return producer ? producer.state : ProducerLaunchState.idle;
        }
    } as ProducerLaunchStateProvider;

    const consumerLaunchStateProvider = {
        getConsumerLaunchState(clusterId: string, consumerGroupId: string): ConsumerLaunchState {
            const consumer = consumerCollection.getByConsumerGroupId(clusterId, consumerGroupId);
            return consumer ? consumer.state : ConsumerLaunchState.idle;
        }
    } as ConsumerLaunchStateProvider;

    const selectedClusterProvider = {
        getSelectedCluster() {
            const selected = clusterSettings.selected;
            return {
                clusterId: selected?.id,
                clusterName: selected?.name,
            };
        }
    } as SelectedClusterProvider;

    const topicProvider = {
        async getTopics(clusterId: string): Promise<TopicDetail[]> {
            // Retrieve the proper cluster item from the explorer
            const model = explorer.getDataModel();
            const cluster = await model.findClusterItemById(clusterId);
            if (!cluster) {
                return [];
            }
            // Returns topics from the cluster
            return (await cluster.getTopics()).map(child => (<TopicItem>child).topic);
        }
    } as TopicProvider;

    return getLanguageService(producerLaunchStateProvider, consumerLaunchStateProvider, selectedClusterProvider, topicProvider);
}

class AbstractKafkaFileFeature {

    constructor(
        private kafkaFileDocuments: LanguageModelCache<KafkaFileDocument>,
        protected readonly languageService: LanguageService
    ) { }

    getKafkaFileDocument(document: vscode.TextDocument): KafkaFileDocument {
        return this.kafkaFileDocuments.get(document);
    }

}

class KafkaFileCodeLensProvider extends AbstractKafkaFileFeature implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(
        kafkaFileDocuments: LanguageModelCache<KafkaFileDocument>,
        languageService: LanguageService
    ) {
        super(kafkaFileDocuments, languageService);
    }

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        return runSafeAsync(async () => {
            const kafkaFileDocument = this.getKafkaFileDocument(document);
            return this.languageService.getCodeLenses(document, kafkaFileDocument);
        }, [], `Error while computing code lenses for ${document.uri}`, token);
    }

    refresh() {
        this._onDidChangeCodeLenses.fire();
    }
}

class KafkaFileCompletionItemProvider extends AbstractKafkaFileFeature implements vscode.CompletionItemProvider {

    constructor(
        kafkaFileDocuments: LanguageModelCache<KafkaFileDocument>,
        languageService: LanguageService
    ) {
        super(kafkaFileDocuments, languageService);
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        return runSafeAsync(async () => {
            const kafkaFileDocument = this.getKafkaFileDocument(document);
            return this.languageService.doComplete(document, kafkaFileDocument, position);
        }, new vscode.CompletionList(), `Error while computing code lenses for ${document.uri}`, token);
    }

}

