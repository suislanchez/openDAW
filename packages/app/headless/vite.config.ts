import {defineConfig} from "vite"
import crossOriginIsolation from "vite-plugin-cross-origin-isolation"
import {readFileSync, existsSync} from "fs"
import {resolve} from "path"

export default defineConfig(({command}) => {
    const keyPath = resolve(__dirname, "../localhost-key.pem");
    const certPath = resolve(__dirname, "../localhost.pem");

    const httpsOptions =
        command === "serve" && existsSync(keyPath) && existsSync(certPath)
            ? {
                  key: readFileSync(keyPath),
                  cert: readFileSync(certPath),
              }
            : undefined;

    return {
        resolve: {
            alias: {
                "@": resolve(__dirname, "./src")
            }
        },
        server: {
            port: 8080,
            host: "localhost",
            https: httpsOptions,
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp"
            },
            fs: {
                // Allow serving files from the entire workspace
                allow: [".."]
            }
        },
        plugins: [
            crossOriginIsolation()
        ]
    };
});
