const db =
    require("../database/db");
const fs = require("fs");
const path = require("path");


class GestorRespaldos {

    constructor(){

        this.carpetaRespaldos = path.join(
            __dirname,
            "../backups"
        );

    }


    asegurarCarpeta(){

        if(!fs.existsSync(this.carpetaRespaldos)){

            fs.mkdirSync(
                this.carpetaRespaldos,
                {
                    recursive:true
                }
            );

        }

    }


    crearNombreFecha(){

        const ahora = new Date();

        const completar = numero =>
            String(numero).padStart(2, "0");

        return (
            `${ahora.getFullYear()}-`
            + `${completar(ahora.getMonth() + 1)}-`
            + `${completar(ahora.getDate())}_`
            + `${completar(ahora.getHours())}-`
            + `${completar(ahora.getMinutes())}-`
            + `${completar(ahora.getSeconds())}`
        );

    }

    crearCopiaBaseDatos(){

        return new Promise(
            (resolve, reject)=>{

                this.asegurarCarpeta();

                const fecha =
                    this.crearNombreFecha();

                const nombreArchivo =
                    `turnos-${fecha}.db`;

                const destino =
                    path.join(
                        this.carpetaRespaldos,
                        nombreArchivo
                    );

                /*
                Database#backup crea una copia coherente
                mediante el mecanismo interno de SQLite,
                incluso si el sistema está funcionando.
                */
                db.backup(
                    destino,
                    error => {

                        if(error){

                            reject(error);
                            return;

                        }

                        fs.stat(
                            destino,
                            (
                                errorEstadistica,
                                datos
                            )=>{

                                if(errorEstadistica){

                                    reject(
                                        errorEstadistica
                                    );

                                    return;

                                }

                                resolve({

                                    nombreArchivo,

                                    ruta:
                                        destino,

                                    tamaño:
                                        datos.size,

                                    fechaCreacion:
                                        new Date()

                                });

                            }
                        );

                    }
                );

            }
        );

    }


    guardarReporteCSV(turnos){

        return new Promise((resolve, reject)=>{

            try{

                this.asegurarCarpeta();

                const fecha =
                    this.crearNombreFecha();

                const nombreArchivo =
                    `reporte-turnos-${fecha}.csv`;

                const destino = path.join(
                    this.carpetaRespaldos,
                    nombreArchivo
                );

                const escapar = valor => {

                    if(
                        valor === null
                        || valor === undefined
                    ){
                        return "";
                    }

                    return `"${String(valor)
                        .replace(/"/g, '""')}"`;

                };

                const encabezados = [
                    "Código",
                    "Trámite",
                    "Estado",
                    "Mesa",
                    "Fecha de creación",
                    "Fecha de llamado",
                    "Fecha de finalización",
                    "Espera en minutos",
                    "Atención en minutos"
                ];

                const filas =
                    turnos.map(turno => [

                        turno.codigo,
                        turno.tramite,
                        turno.estado,
                        turno.mesa,
                        turno.fechaCreacion,
                        turno.fechaLlamado,
                        turno.fechaFinalizado,
                        turno.tiempoEsperaMinutos,
                        turno.tiempoAtencionMinutos

                    ].map(escapar).join(","));

                const csv = [

                    encabezados
                        .map(escapar)
                        .join(","),

                    ...filas

                ].join("\r\n");

                fs.writeFileSync(
                    destino,
                    "\uFEFF" + csv,
                    "utf8"
                );

                resolve({
                    nombreArchivo,
                    ruta:destino
                });

            }catch(error){

                reject(error);

            }

        });

    }


    listarRespaldos(){

        return new Promise((resolve, reject)=>{

            try{

                this.asegurarCarpeta();

                const archivos =
                    fs.readdirSync(
                        this.carpetaRespaldos
                    );

                const respaldos =
                    archivos
                        .filter(nombre =>
                            nombre.endsWith(".db")
                        )
                        .map(nombre => {

                            const ruta = path.join(
                                this.carpetaRespaldos,
                                nombre
                            );

                            const datos =
                                fs.statSync(ruta);

                            const coincidencia = nombre.match(
                                /turnos-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.db/
                            );

                            let fechaRespaldo = datos.mtime;

                            if(coincidencia){

                                const [
                                    ,
                                    año,
                                    mes,
                                    dia,
                                    hora,
                                    minuto,
                                    segundo
                                ] = coincidencia;

                                fechaRespaldo = new Date(
                                    Number(año),
                                    Number(mes) - 1,
                                    Number(dia),
                                    Number(hora),
                                    Number(minuto),
                                    Number(segundo)
                                );

                            }

                            return {
                                nombre,
                                tamaño:datos.size,
                                fecha:fechaRespaldo,
                                fechaMilisegundos:fechaRespaldo.getTime()
                            };

                        })
                        .sort(
                            (a, b) =>
                                b.fechaMilisegundos
                                - a.fechaMilisegundos
                        );

                const tamañoTotal =
                    respaldos.reduce(
                        (total, respaldo) =>
                            total + respaldo.tamaño,
                        0
                    );

                resolve({
                    cantidad:respaldos.length,
                    tamañoTotal,
                    ultimo:
                        respaldos.length
                            ? respaldos[0]
                            : null,
                    respaldos
                });

            }catch(error){

                reject(error);

            }

        });

    }

    eliminarRespaldosAntiguos(dias){

        return new Promise((resolve, reject)=>{

            try{

                this.asegurarCarpeta();

                const diasValidos =
                    Number(dias);

                if(
                    !Number.isInteger(diasValidos)
                    || diasValidos < 1
                ){

                    throw new Error(
                        "La cantidad de días no es válida"
                    );

                }

                const limite =
                    Date.now()
                    - diasValidos
                    * 24
                    * 60
                    * 60
                    * 1000;

                const archivos =
                    fs.readdirSync(
                        this.carpetaRespaldos
                    );

                let eliminados = 0;
                let espacioLiberado = 0;

                for(const nombre of archivos){

                    const esRespaldo =
                        nombre.endsWith(".db")
                        || nombre.endsWith(".csv");

                    if(!esRespaldo){
                        continue;
                    }

                    const ruta =
                        path.join(
                            this.carpetaRespaldos,
                            nombre
                        );

                    const datos =
                        fs.statSync(ruta);

                    if(datos.mtimeMs < limite){

                        espacioLiberado +=
                            datos.size;

                        fs.unlinkSync(ruta);

                        eliminados++;

                    }

                }

                resolve({
                    eliminados,
                    espacioLiberado
                });

            }catch(error){

                reject(error);

            }

        });

    }

}

module.exports = new GestorRespaldos();