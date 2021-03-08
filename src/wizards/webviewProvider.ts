import { Disposable, Uri, ViewColumn, WebviewPanel, window } from "vscode";

export default abstract class WebviewProvider implements Disposable {

    private panel: WebviewPanel;
    private disposables: Disposable[] = [];
    protected abstract viewType: string;
    protected abstract title: string;
    protected abstract viewColumn: ViewColumn;

    public show() {
        if (!this.panel) {
            this.panel = window.createWebviewPanel(
                this.viewType,
                this.title,
                {
                    viewColumn: this.viewColumn,
                    preserveFocus: true,
                },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true, // @OPTIMIZE remove and migrate to state restore
                    enableCommandUris: true,
                    //localResourceRoots: [Uri.file(Context.extensionPath), Uri.file(path.resolve(Context.extensionPath, '..'))],
                    // enableFindWidget: true,
                },
            );
        }
    }

    dispose(): void {

    }

}
