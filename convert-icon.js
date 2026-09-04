const fs = require("fs");
const pngToIco = require("png-to-ico").default;

(async () => {

    const ico = await pngToIco(
        "build/icon.png"
    );

    fs.writeFileSync(
        "build/icon.ico",
        ico
    );

    console.log("Icono generado correctamente.");

})();