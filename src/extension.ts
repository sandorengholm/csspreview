import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    let previewUri = vscode.Uri.parse('css-preview://authority/css-preview');

    class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
        private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

        public provideTextDocumentContent(uri: vscode.Uri): string {
            return this.createCssSnippet();
        }

        get onDidChange(): vscode.Event<vscode.Uri> {
            return this._onDidChange.event;
        }

        public update(uri: vscode.Uri) {
            this._onDidChange.fire(uri);
        }

        private createCssSnippet() {
            let editor = vscode.window.activeTextEditor;
            if (editor?.document.languageId !== 'css') {
                return this.errorSnippet("Active editor doesn't show a CSS document - no properties to preview.");
            }
            return this.extractSnippet();
        }

        private extractSnippet(): string {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const text = editor.document.getText();
                const selStart = editor.document.offsetAt(editor.selection.anchor);
                const propStart = text.lastIndexOf('{', selStart);
                const propEnd = text.indexOf('}', selStart - 1);
                const stylenameStart = text.lastIndexOf('}', selStart - 2);
                const stylenameEnd = text.indexOf('{', stylenameStart);

                const stylename = text.slice(stylenameStart + 1, stylenameEnd).trim();

                if (stylename.length === 0) {
                    return this.errorSnippet("Cannot determine the rule's properties.");
                } else {
                    const cssStyles = text.slice(stylenameEnd + 1, text.indexOf('}', stylenameEnd + 1));

                    return this.snippet(cssStyles, stylename, editor.document, stylenameStart + 1, propEnd);
                }
            } else {
                return this.errorSnippet('There is no active editor');
            }
        }

        private errorSnippet(error: string): string {
            return `
				<body>
					${error}
                </body>
            `;
        }

        private snippet(cssStyles: string, stylename: string, document: vscode.TextDocument, propStart: number, propEnd: number): string {


            let regex = /([\w-]*)\s*:\s*([^;]*)/g;
            let match;
            let properties = {};
            while (match = regex.exec(cssStyles)) {
                (properties as any)[match[1]] = match[2].trim();
            }

            let text = (properties as any)["--text"];

            return `
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        position: relative;

                        width: 100%;
                        padding: 0 20px;
                        margin: 0;
                        box-sizing: border-box;
                        overflow-x: hidden;
                        overflow-y: scroll;

                        font-family: verdana;
                        background-color: white;
                    }
                    .guideline {
                        position: absolute;
                        top: 0;
                        z-index: 1;

                        width: 20px;
                        height: calc(100% + 16px);
                        min-height: 100vh;

                        background-color: rgba(255, 230, 191, 0.8);
                    }
                    .guideline.left {
                        left: 0;
                    }
                    .guideline.right {
                        right: 0;
                    }
                    .guideline.top {
                        position: relative;

                        width: 100%;
                        height: auto;
                        min-height: auto;
                        padding: 10px 0;
                    }
                    h1 {
                        margin-bottom: 10px;
                        color: #555;
                        font-size: 16px;
                        font-weight: 100;
                    }
                    h2 {
                        color: #444;
                        font-size: 10px;
                        font-weight: bold;
                    }
                    .container {
                        position: relative;
                        z-index: 0;
                    }
                    .selected-element {
                        position: relative;
                        box-sizing: border-box;
                        border: 1px dashed #777;
                        color: black;
                        ${cssStyles}
                    }
                    .selected-element:before {
                        content: '${(properties as any)["height"]}';

                        position: absolute;
                        right: 0;
                        top: 50%;
                        z-index: 2;
                        transform: translate(calc(100% + 5px), -50%);

                        width: 15px;

                        writing-mode: vertical-rl;
                        text-orientation: sideways;
                        font-size: 10px;
                        color: #777;
                        line-height: 2;
                    }
                    .selected-element:after {
                        content: '${(properties as any)["width"]}';

                        position: absolute;
                        bottom: 0;
                        left: 50%;
                        z-index: 2;                        
                        transform: translate(-50%, calc(100% + 5px));

                        height: 15px;

                        font-size: 10px;
                        color: #777;
                        line-height: 1;                        
                    }
                </style>
                <body>
                    <div class="guideline left"></div>
                    <div class="guideline right"></div>
                    <div class="guideline top">
                        <h1>${stylename}</h1>
					    <!--<h2 class="previewtext">Highlight <a href="${encodeURI('command:extension.revealCssRule?' + JSON.stringify([document.uri, propStart, propEnd]))}">CSS selector</a></h2>-->
                    </div>
                    <div class="container">
                        <div class="selected-element"></div>
                    </div>
                    <script>
                        document.querySelector(".selected-element").innerHTML = ${text ? text : ''};
                    </script>
                </body>
            `;
        }
    }


    let provider = new TextDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('css-preview', provider);
    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        if (e.document === vscode.window.activeTextEditor?.document) {
            provider.update(previewUri);
        }
    });

    vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
        if (e.textEditor === vscode.window.activeTextEditor) {
            provider.update(previewUri);
        }
    });

    let disposable = vscode.commands.registerCommand('csspreview.launch', () => {
        let panel = vscode.window.createWebviewPanel('CSS Preview', 'CSS Preview', vscode.ViewColumn.Two, {});
        panel.webview.html = provider.provideTextDocumentContent(previewUri);

        vscode.window.onDidChangeTextEditorSelection(() => {
            panel.webview.html = provider.provideTextDocumentContent(previewUri);
        });
    });

    let highlight = vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(200,200,200,.35)' });

    vscode.commands.registerCommand('extension.revealCssRule', (uri: vscode.Uri, propStart: number, propEnd: number) => {
        for (let editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.toString() === uri.toString()) {
                let start = editor.document.positionAt(propStart);
                let end = editor.document.positionAt(propEnd + 1);

                editor.setDecorations(highlight, [new vscode.Range(start, end)]);
                setTimeout(() => editor.setDecorations(highlight, []), 1500);
            }
        }
    });

    context.subscriptions.push(disposable, registration);
}