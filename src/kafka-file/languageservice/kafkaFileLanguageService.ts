import { CodeLens, TextDocument, Uri } from "vscode";
import { ConsumerLaunchState } from "../../client";
import { ProducerLaunchState } from "../../client/producer";
import { KafkaFileDocument, parseKafkaFile } from "./parser/kafkaFileParser";
import { KafkaFileDocumentCodeLenses } from "./services/codeLensProvider";

/**
 * Provider API which gets the state for a given producer.
 */
export interface ProducerLaunchStateProvider {
    getProducerLaunchState(uri: Uri): ProducerLaunchState;
}

/**
 * Provider API which gets the state for a given consumer.
 */
export interface ConsumerLaunchStateProvider {
    getConsumerLaunchState(clusterId: string, consumerGroupId: string): ConsumerLaunchState;
}

/**
 * Provider API which gets the selected cluster id and name.
 */
export interface SelectedClusterProvider {
    getSelectedCluster(): { clusterId?: string, clusterName?: string };
}

/**
 * Kafka language service API.
 * 
 */
export interface LanguageService {
    /**
     * Parse the given text document and returns an AST.
     * 
     * @param document the text document of a kafka file.
     * 
     * @returns the parsed AST.
     */
    parseKafkaFileDocument(document: TextDocument): KafkaFileDocument;

    /**
     * Returns the code lenses for the given text document and parsed AST.
     * 
     * @param document the text document.
     * @param kafkaFileDocument the parsed AST.
     * 
     * @returns the code lenses.
     */
    getCodeLenses(document: TextDocument, kafkaFileDocument: KafkaFileDocument): CodeLens[];
}

/**
 * Returns the Kafka file language service which manages codelens, completion, validation features for kafka file.
 * 
 * @param producerLaunchStateProvider the provider which gets the state for a given producer.
 * @param consumerLaunchStateProvider the provider which gets the state for a given consumer.
 * @param selectedClusterProvider the provider which gets the selected cluster id and name. 
 */
export function getLanguageService(producerLaunchStateProvider: ProducerLaunchStateProvider, consumerLaunchStateProvider: ConsumerLaunchStateProvider, selectedClusterProvider: SelectedClusterProvider): LanguageService {

    const kafkaFileDocumentCodeLenses = new KafkaFileDocumentCodeLenses(producerLaunchStateProvider, consumerLaunchStateProvider, selectedClusterProvider);
    return {
        parseKafkaFileDocument: (document: TextDocument) => parseKafkaFile(document),
        getCodeLenses: kafkaFileDocumentCodeLenses.getCodeLenses.bind(kafkaFileDocumentCodeLenses)
    };
}
