"use strict";

const fs = require("fs");
const path = require("path");

const VERSION_FILE =
    path.join(
        __dirname,
        "..",
        "config",
        "version.json"
    );

let cachedIdentity = null;

function validateIdentity(data) {

    if (!data || typeof data !== "object") {
        throw new Error(
            "El archivo version.json no contiene un objeto válido."
        );
    }

    if (!data.product?.name) {
        throw new Error(
            "Falta product.name en version.json."
        );
    }

    if (!data.product?.appId) {
        throw new Error(
            "Falta product.appId en version.json."
        );
    }

    if (!data.release?.version) {
        throw new Error(
            "Falta release.version en version.json."
        );
    }

    return data;
}

function loadIdentity() {

    if (cachedIdentity) {
        return cachedIdentity;
    }

    const rawContent =
        fs.readFileSync(
            VERSION_FILE,
            "utf8"
        )
        .replace(/^\uFEFF/, "");

    const parsedIdentity =
        JSON.parse(rawContent);

    cachedIdentity =
        Object.freeze(
            validateIdentity(parsedIdentity)
        );

    return cachedIdentity;
}

function getPublicIdentity() {

    const identity =
        loadIdentity();

    return {
        product: {
            name:
                identity.product.name,

            description:
                identity.product.description,

            company:
                identity.product.company,

            appId:
                identity.product.appId
        },

        release: {
            version:
                identity.release.version,

            channel:
                identity.release.channel,

            codename:
                identity.release.codename,

            build:
                identity.release.build
        },

        legal: {
            copyright:
                identity.legal.copyright,

            rights:
                identity.legal.rights
        },

        support: {
            website:
                identity.support.website,

            email:
                identity.support.email
        }
    };
}

function clearIdentityCache() {

    cachedIdentity =
        null;
}

module.exports = {
    loadIdentity,
    getPublicIdentity,
    clearIdentityCache
};
