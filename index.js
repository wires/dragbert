import App from "./App.svelte"

let app = new App({
    target: document.body,
});

import.meta.hot.decline();

export default app;