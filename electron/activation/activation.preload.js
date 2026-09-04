"use strict";

const {
    contextBridge,
    ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
    "linkLicense",
    {

        obtenerDatos(){

            return ipcRenderer.invoke(
                "license:get-activation-data"
            );

        },

        copiar(texto){

            return ipcRenderer.invoke(
                "license:copy",
                texto
            );

        },

        importar(){

            return ipcRenderer.invoke(
                "license:import"
            );

        }

    }
);