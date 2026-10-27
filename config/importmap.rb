# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"
pin_all_from "app/javascript/editor", under: "editor", preload: "editor"

# CodeMirror and its dependencies, only preloaded on the editor page
pin "@codemirror/commands", to: "@codemirror--commands.js", preload: "editor" # @6.11.1
pin "@codemirror/lang-python", to: "@codemirror--lang-python.js", preload: "editor" # @6.2.1
pin "codemirror", preload: "editor" # @6.0.2
pin "@codemirror/autocomplete", to: "@codemirror--autocomplete.js", preload: "editor" # @6.20.4
pin "@codemirror/lint", to: "@codemirror--lint.js", preload: "editor" # @6.9.7
pin "@codemirror/search", to: "@codemirror--search.js", preload: "editor" # @6.7.2
pin "@lezer/lr", to: "@lezer--lr.js", preload: "editor" # @1.4.11
pin "@lezer/python", to: "@lezer--python.js", preload: "editor" # @1.1.19
pin "@codemirror/language", to: "@codemirror--language.js", preload: "editor" # @6.13.1
pin "@codemirror/state", to: "@codemirror--state.js", preload: "editor" # @6.7.6
pin "@codemirror/view", to: "@codemirror--view.js", preload: "editor" # @6.43.15
pin "@lezer/highlight", to: "@lezer--highlight.js", preload: "editor" # @1.2.5
pin "@codemirror/streamparser", to: "@codemirror--streamparser.js", preload: "editor" # @6.0.0
pin "@lezer/common", to: "@lezer--common.js", preload: "editor" # @1.5.4
pin "@marijn/find-cluster-break", to: "@marijn--find-cluster-break.js", preload: "editor" # @1.0.4
pin "crelt", preload: "editor" # @1.0.7
pin "style-mod", preload: "editor" # @4.1.4
pin "w3c-keyname", preload: "editor" # @2.2.8
