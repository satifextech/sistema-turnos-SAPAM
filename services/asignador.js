const gestorTurnos =
    require("./gestorTurnos");

const gestorReglas =
    require("./gestorReglas");


class Asignador {


    /*
    Busca primero un turno prioritario.

    Si no existe ninguno, intenta localizar
    un turno que pueda ser atendido como apoyo.
    */
    async buscarTurno(numeroMesa){

        const mesa =
            Number(numeroMesa);

        if(
            !Number.isInteger(mesa)
            || mesa <= 0
        ){

            return null;

        }

        let turno =
            await this.buscarTurnoPrioridad(
                mesa
            );

        if(turno){

            return turno;

        }

        turno =
            await this.buscarTurnoApoyo(
                mesa
            );

        return turno;

    }


    /*
    Obtiene desde SQLite todos los trámites
    asociados al punto de atención indicado.
    */
    async obtenerConfiguracionMesa(
        numeroMesa
    ){

        const reglas =
            await gestorReglas
                .obtenerReglasParaMesa(
                    numeroMesa
                );

        return {

            prioridad:
                reglas.filter(
                    regla =>
                        regla.tipo
                        === "prioridad"
                ),

            apoyo:
                reglas.filter(
                    regla =>
                        regla.tipo
                        === "apoyo"
                )

        };

    }


    /*
    Busca turnos pertenecientes a los trámites
    prioritarios de la mesa.

    Las reglas ya llegan ordenadas desde SQLite.
    */
    async buscarTurnoPrioridad(
        numeroMesa
    ){

        const configuracion =
            await this.obtenerConfiguracionMesa(
                numeroMesa
            );

        if(
            !Array.isArray(
                configuracion.prioridad
            )
            ||
            configuracion.prioridad.length === 0
        ){

            return null;

        }

        for(
            const regla
            of configuracion.prioridad
        ){

            const tramite =
                String(
                    regla.tramite || ""
                ).trim();

            if(!tramite){

                continue;

            }

            const turno =
                await gestorTurnos
                    .buscarPrimerTurno(
                        [tramite]
                    );

            if(turno){

                return turno;

            }

        }

        return null;

    }


    /*
    Busca turnos de los trámites configurados
    como apoyo para la mesa.
    */
    async buscarTurnoApoyo(
        numeroMesa
    ){

        const configuracion =
            await this.obtenerConfiguracionMesa(
                numeroMesa
            );

        if(
            !Array.isArray(
                configuracion.apoyo
            )
            ||
            configuracion.apoyo.length === 0
        ){

            return null;

        }

        for(
            const regla
            of configuracion.apoyo
        ){

            const tramite =
                String(
                    regla.tramite || ""
                ).trim();

            if(!tramite){

                continue;

            }

            const necesitaApoyo =
                await this.necesitaApoyo(
                    tramite
                );

            if(!necesitaApoyo){

                continue;

            }

            const turno =
                await gestorTurnos
                    .buscarPrimerTurno(
                        [tramite]
                    );

            if(turno){

                return turno;

            }

        }

        return null;

    }


    /*
    Determina si una mesa de apoyo puede atender
    un trámite.

    Puede hacerlo cuando:

    1. No existe ninguna mesa prioritaria disponible.

    2. La cantidad de turnos pendientes alcanzó
       el límite configurado en Administración.
    */
    async necesitaApoyo(tramite){

        const pendientes =
            await gestorTurnos
                .contarPendientes(
                    tramite
                );

        if(pendientes === 0){

            return false;

        }

        const reglaTramite =
            await gestorReglas
                .obtenerReglaTramite(
                    tramite
                );

        if(
            !reglaTramite
            ||
            Number(
                reglaTramite.activo
            ) !== 1
        ){

            return false;

        }

        /*
        Este método devuelve únicamente las mesas
        prioritarias que actualmente están:

        - activas;
        - habilitadas para turnos;
        - en estado disponible.
        */
        const mesasPrioritariasDisponibles =
            await gestorReglas
                .obtenerMesasPrioritarias(
                    tramite
                );

        if(
            mesasPrioritariasDisponibles
                .length === 0
        ){

            return true;

        }

        const limite =
            Number(
                reglaTramite.limiteApoyo
            );

        if(
            !Number.isInteger(limite)
            ||
            limite < 1
        ){

            return false;

        }

        return pendientes >= limite;

    }


}


module.exports =
    new Asignador();