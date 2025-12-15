import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'login/index.html'),
                share: resolve(__dirname, 'share.html'),
                chat: resolve(__dirname, 'chat/index.html'),
            },
        },
    },
});
