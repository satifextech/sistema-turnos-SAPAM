"use strict";

const LICENSE_STATUS = Object.freeze({

    ACTIVE:
        "ACTIVE",

    WARNING:
        "WARNING",

    GRACE:
        "GRACE",

    EXPIRED:
        "EXPIRED",

    NOT_INSTALLED:
        "NOT_INSTALLED",

    INVALID:
        "INVALID",

    HARDWARE_MISMATCH:
        "HARDWARE_MISMATCH",

    DEVICE_MISMATCH:
        "DEVICE_MISMATCH",

    PRODUCT_MISMATCH:
        "PRODUCT_MISMATCH"

});

module.exports =
    LICENSE_STATUS;