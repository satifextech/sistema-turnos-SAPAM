"use strict";

const {
    contextBridge,
    ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
    "linkBlocking",
    {
        obtenerEstado() {
            return ipcRenderer.invoke(
                "cloud-blocking:get-status"
            );
        },

        reintentar() {
            return ipcRenderer.invoke(
                "cloud-blocking:retry"
            );
        },

        cerrar() {
            return ipcRenderer.invoke(
                "cloud-blocking:close"
            );
        },

        onStatusChanged(callback) {
            const listener =
                (_event, status) => {
                    callback(status);
                };

            ipcRenderer.on(
                "cloud-blocking:status-changed",
                listener
            );

            return () => {
                ipcRenderer.removeListener(
                    "cloud-blocking:status-changed",
                    listener
                );
            };
        }
    }
);