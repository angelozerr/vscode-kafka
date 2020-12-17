import * as vscode from "vscode";
import { ConsumedRecord, ConsumerChangedStatusEvent, ConsumerCollection, ConsumerCollectionChangedEvent, RecordReceivedEvent } from "../client";

class ConsumerTerminal {
    private terminal;
    private writeEmitter = new vscode.EventEmitter<string>();
    constructor(uri: vscode.Uri, registry: ConsumerTerminalRegistry) {

        const pty = {
            onDidWrite: this.writeEmitter.event,
            open: () => { },
            close: () => { registry.closeTerminal(uri) },
        };
        this.terminal = (<any>vscode.window).createTerminal({ name: `Kafka[${uri.path}]`, pty });
    }

    public show(): void {
        this.terminal.show();
    }

    public sendText(data: string) {
        this.writeEmitter.fire(data);
    }
}

export class ConsumerTerminalRegistry implements vscode.Disposable {

    private terminals: { [id: string /* vscode URI */]: ConsumerTerminal } = {};
    private disposables: vscode.Disposable[] = [];

    constructor(private consumerCollection: ConsumerCollection) {

        this.disposables.push(this.consumerCollection.onDidChangeCollection((event: ConsumerCollectionChangedEvent) => {
            for (const startedUri of event.created) {
                this.showTerminal(startedUri);
                this.onDidChangeStatus(startedUri, 'started');
                this.attachToConsumer(startedUri);
            }

            for (const closedUri of event.closed) {
                this.onDidCloseConsumer(closedUri);
            }
        }));
    }

    private showTerminal(uri: vscode.Uri): void {
        let terminal = this.terminals[uri.toString()];
        if (!terminal) {
            terminal = new ConsumerTerminal(uri, this);
            this.terminals[uri.toString()] = terminal;
            terminal.show();
        }
    }

    public dispose(): void {
        this.consumerCollection.dispose();
        this.disposables.forEach(d => d.dispose());
    }


    private attachToConsumer(uri: vscode.Uri): void {
        const consumer = this.consumerCollection.get(uri);

        if (consumer === null) {
            return;
        }

        this.disposables.push(consumer.onDidReceiveRecord((arg: RecordReceivedEvent) => {
            this.onDidReceiveRecord(arg.uri, arg.record);
        }));

        this.disposables.push(consumer.onDidChangeStatus((arg: ConsumerChangedStatusEvent) => {
            this.onDidChangeStatus(arg.uri, arg.status);
        }));
    }

    private onDidChangeStatus(uri: vscode.Uri, status: string): void {
        let terminal = this.terminals[uri.toString()];
        if (terminal) {
            terminal.sendText(`Consumer: ${status}\r\n`);
        }
    }

    private onDidReceiveRecord(uri: vscode.Uri, message: ConsumedRecord): void {
        let terminal = this.terminals[uri.toString()];
        if (terminal) {
            terminal.sendText(`\r\n`);
            terminal.sendText(`Key: ${message.key}\r\n`);
            terminal.sendText(`Partition: ${message.partition}\r\n`);
            terminal.sendText(`Offset: ${message.offset}\r\n`);
            terminal.sendText(`Value:\n${message.value}\r\n`);
        }
    }

    private onDidCloseConsumer(uri: vscode.Uri): void {
        this.onDidChangeStatus(uri, 'closed');
    }

    closeTerminal(uri: vscode.Uri) {
        delete this.terminals[uri.toString()];
        if (this.consumerCollection.has(uri)) {
            this.consumerCollection.close(uri);
        }
    }

}
