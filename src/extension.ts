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

            let content = (properties as any)["--content"];

            const textEditorContent = vscode.window.activeTextEditor?.document.getText();

            return `
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        position: relative;
                        width: 100%;
                        height: 100vh;
                        padding: 30px;
                        box-sizing: border-box;
                        overflow-x: hidden;
                        overflow-y: scroll;
                        font-family: verdana;
                        background-color: #3b4b58;
                    }
                    .csspreview-h1 {
                        margin-bottom: 10px;
                        color: #f1f1f1;
                        font-size: 16px;
                        font-weight: 100;
                    }
                    .csspreview-h2 {
                        color: #f1f1f1;
                        font-size: 10px;
                        font-weight: bold;
                    }
                    .csspreview-button {
                        border: 1px solid black;
                        background-color: white;
                        padding: 5px;
                        cursor: pointer;
                    }
                    .csspreview-button:focus {
                        outline: none;
                    }
                    .csspreview-inner-container {
                        position: absolute;
                        top: 100px;
                        right: 30px;
                        bottom: 30px;
                        left: 30px;
                        background-color: white;
                    }
                    .csspreview-preview-element--specs {
                        border: 1px dashed #777;
                    }
                    .csspreview-preview-element {
                        position: relative;
                        box-sizing: border-box;
                        color: black;
                        ${cssStyles}
                    }
                    .csspreview-preview-element--specs:before,
                    .csspreview-preview-element--specs:after {
                        position: absolute;
                        z-index: 2; 
                        font-size: 10px;
                        color: #777;
                        letter-spacing: 1px;
                        margin: 0;
                        padding: 3px;
                        line-height: 1.5;
                        background-color: white;
                    }
                    .csspreview-preview-element--specs:before {
                        content: '${(properties as any)["height"] ? (properties as any)["height"] : ''}';
                        right: 0;
                        top: 50%;
                        transform: translate(calc(100% + 5px), -50%);
                        width: 15px;
                        writing-mode: vertical-rl;
                        text-orientation: sideways;
                    }
                    .csspreview-preview-element--specs:after {
                        content: '${(properties as any)["width"] ? (properties as any)["width"] : ''}';
                        bottom: 0;
                        left: 50%;               
                        transform: translate(-50%, calc(100% + 5px));
                        height: 15px;
                    }

                    ${textEditorContent}
                </style>
                <body>
                    <div class="csspreview-h1">${stylename}</div>
                    <button class="csspreview-button" onclick="toggleSpecs()">Toggle Specs</button>
                    <!--<h2 class="previewtext">Highlight <a href="${encodeURI('command:extension.revealCssRule?' + JSON.stringify([document.uri, propStart, propEnd]))}">CSS selector</a></h2>-->

                    <div class="csspreview-inner-container">
                        <div id="csspreview-preview-element" class="csspreview-preview-element csspreview-preview-element--specs">${content ? content : ''}</div>
                    </div>
                    
                    <script>
                        function toggleSpecs() {
                            var elm = document.getElementById('csspreview-preview-element');
                            if (elm) {
                                elm.classList.toggle('csspreview-preview-element--specs');
                            }
                        }
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
        let panel = vscode.window.createWebviewPanel('CSS Preview', 'CSS Preview', vscode.ViewColumn.Two, { enableScripts: true });
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