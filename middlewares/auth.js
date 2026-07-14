function leerCookies(req){

    const encabezado =
        req.headers.cookie || "";

    const cookies = {};

    encabezado
        .split(";")
        .map(valor => valor.trim())
        .filter(Boolean)
        .forEach(par => {

            const posicion =
                par.indexOf("=");

            if(posicion === -1){
                return;
            }

            const nombre =
                par.slice(0, posicion);

            const valor =
                par.slice(posicion + 1);

            cookies[nombre] =
                decodeURIComponent(valor);

        });

    return cookies;

}

module.exports = {
    leerCookies
};