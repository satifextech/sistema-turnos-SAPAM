const mesas = require("../config/mesas");
const tramites = require("../config/tramites");
const reglasApoyo = require("../config/reglasApoyo");
const db = require("../database/db");
const gestorTurnos = require("./gestorTurnos");
const gestorMesa = require("./gestorMesa");
const gestorReglas = require("./gestorReglas");

class Asignador {

    constructor() {

        this.mesas = mesas;
        this.tramites = tramites;
        this.reglasApoyo = reglasApoyo;

    }

    /*obtenerReglas(tramite){

        return this.reglas.tramites[tramite];

    }*/

    obtenerMesa(mesa){

        return this.mesas[mesa];

    }

    obtenerTramite(tramite){

        return this.tramites[tramite];

    }

    obtenerMesasPrioritarias(tramite){

        const resultado = [];

        for(const numero in this.mesas){

            const configuracion =
                this.mesas[numero];

            const esPrioritaria =
                configuracion.prioridad.some(
                    regla =>
                        regla.tramite === tramite
                );

            if(esPrioritaria){

                resultado.push(
                    Number(numero)
                );

            }

        }

        return resultado;

    }

    async buscarTurno(mesa){

        let turno =
            await this.buscarTurnoPrioridad(mesa);

        if(turno){

            return turno;

        }

        turno =
            await this.buscarTurnoApoyo(mesa);

        return turno;

    }


    async necesitaApoyo(tramite){

        /*
        Contamos cuántos turnos de este trámite
        se encuentran actualmente en espera.
        */
        const pendientes =
            await gestorTurnos.contarPendientes(
                tramite
            );

        if(pendientes === 0){

            return false;

        }

        /*
        Consultamos en SQLite la configuración general
        del trámite, incluido su límite de apoyo.
        */
        const reglaTramite =
            await gestorReglas
                .obtenerReglaTramite(tramite);

        /*
        Si el trámite no tiene una regla dinámica,
        no permitimos apoyo para evitar asignaciones
        incorrectas.
        */
        if(
            !reglaTramite
            || Number(reglaTramite.activo) !== 1
        ){

            return false;

        }

        /*
        Consultamos las mesas prioritarias activas
        configuradas para este trámite.
        */
        const mesasPrioritarias =
            await gestorReglas
                .obtenerMesasPrioritarias(
                    tramite
                );

        /*
        El gestor devuelve solamente las mesas
        prioritarias que están disponibles.
        Si el arreglo está vacío, significa que ninguna
        mesa prioritaria puede atender en este momento.
        */
        const existePrioritariaDisponible =
            mesasPrioritarias.length > 0;

        /*
        Si ninguna mesa prioritaria está disponible,
        una mesa de apoyo puede atender desde el
        primer turno pendiente.
        */
        if(!existePrioritariaDisponible){

            return true;

        }

        const limite =
            Number(reglaTramite.limiteApoyo);

        return pendientes >= limite;

    }

    async buscarTurnoPrioridad(numeroMesa){

        /*
        Obtiene primero la configuración dinámica.
        Si aún no existe utilizará automáticamente
        la configuración antigua.
        */

        const configuracion =
            await this.obtenerConfiguracionMesa(
                numeroMesa
            );

        if(
            !configuracion
            ||
            configuracion.prioridad.length===0
        ){

            return null;

        }

        /*
        Recorremos cada prioridad
        en el orden definido.
        */

        for(
            const prioridad
            of configuracion.prioridad
        ){

            /*
            Cuando viene desde SQLite
            el nombre del trámite está
            en "tramite".
            */

            const codigoTramite =
                prioridad.tramite
                ||
                prioridad.codigo
                ||
                prioridad.nombre
                ||
                prioridad.id
                ||
                prioridad.tramiteCodigo;

            if(!codigoTramite){

                continue;

            }

            const turno =
                await gestorTurnos
                    .buscarPrimerTurno(
                        [codigoTramite]
                    );

            if(turno){

                return turno;

            }

        }

        return null;

    }


    async buscarTurnoApoyo(mesa){

        /*
        Obtenemos las reglas dinámicas de la mesa.
        Si no existen, el método conserva temporalmente
        la compatibilidad con la configuración antigua.
        */
        const mesaConfig =
            await this.obtenerConfiguracionMesa(mesa);

        if(
            !mesaConfig
            || !Array.isArray(mesaConfig.apoyo)
            || mesaConfig.apoyo.length === 0
        ){

            return null;

        }

        /*
        Recorremos los trámites de apoyo respetando
        el orden configurado.
        */
        for(const apoyo of mesaConfig.apoyo){

            const tramite =
                apoyo.tramite
                || apoyo.codigo
                || apoyo.nombre
                || apoyo.id
                || apoyo.tramiteCodigo;

            if(!tramite){

                continue;

            }

            /*
            Comprobamos si el trámite ya alcanzó
            las condiciones necesarias para recibir apoyo.
            */
            const necesita =
                await this.necesitaApoyo(tramite);

            if(!necesita){

                continue;

            }

            /*
            Buscamos el turno más antiguo que esté
            esperando para este trámite.
            */
            const turno =
                await new Promise(
                    (resolve, reject)=>{

                        db.get(
                            `
                            SELECT *
                            FROM turnos

                            WHERE
                                estado='espera'
                                AND tramite=?

                            ORDER BY id ASC

                            LIMIT 1
                            `,
                            [tramite],
                            (err, row)=>{

                                if(err){

                                    reject(err);
                                    return;

                                }

                                resolve(row || null);

                            }
                        );

                    }
                );

            if(turno){

                return turno;

            }

        }

        return null;

    }

async obtenerConfiguracionMesa(numeroMesa){

    /*
    Primero intentaremos obtener las reglas
    dinámicas almacenadas en SQLite.
    */

    const reglas =
        await gestorReglas
            .obtenerReglasParaMesa(
                numeroMesa
            );

    /*
    Si existen reglas dinámicas,
    utilizaremos únicamente esas.
    */

    if(
        reglas
        &&
        reglas.length > 0
    ){

        return{

            origen:"sqlite",

            prioridad:
                reglas
                    .filter(
                        r =>
                            r.tipo==="prioridad"
                    ),

            apoyo:
                reglas
                    .filter(
                        r =>
                            r.tipo==="apoyo"
                    )

        };

    }

    /*
    Compatibilidad temporal.
    */

    const configuracionVieja =
        this.obtenerMesa(numeroMesa);

    if(!configuracionVieja){

        return{

            origen:"ninguno",

            prioridad:[],

            apoyo:[]

        };

    }

    return{

        origen:"config",

        prioridad:
            configuracionVieja.prioridad,

        apoyo:
            configuracionVieja.apoyo

    };

}



}

module.exports = new Asignador();