const db =
    require("./db");


function consultarUno(
    sql,
    parametros = []
){

    return new Promise(
        (resolve, reject)=>{

            db.get(
                sql,
                parametros,
                (error, fila)=>{

                    if(error){

                        reject(error);
                        return;

                    }

                    resolve(
                        fila || null
                    );

                }
            );

        }
    );

}


function consultarTodos(
    sql,
    parametros = []
){

    return new Promise(
        (resolve, reject)=>{

            db.all(
                sql,
                parametros,
                (error, filas)=>{

                    if(error){

                        reject(error);
                        return;

                    }

                    resolve(
                        filas || []
                    );

                }
            );

        }
    );

}


async function inspeccionar(){

    try{

        console.log(
            "\n========================================"
        );

        console.log(
            "INSPECCIÓN DE BASE DE DATOS SAPAM"
        );

        console.log(
            "========================================\n"
        );


        const integridad =
            await consultarUno(
                "PRAGMA integrity_check"
            );

        console.log(
            "Integridad:",
            integridad
        );


        const objetos =
            await consultarTodos(
                `
                SELECT
                    type AS tipo,
                    name AS nombre,
                    tbl_name AS tabla

                FROM sqlite_master

                WHERE
                    name NOT LIKE 'sqlite_%'

                ORDER BY
                    type ASC,
                    name ASC
                `
            );

        console.log(
            "\nTablas e índices:"
        );

        console.table(
            objetos
        );


        const tablas =
            objetos
                .filter(
                    objeto =>
                        objeto.tipo
                        === "table"
                )
                .map(
                    objeto =>
                        objeto.nombre
                );


        const conteos = [];

        for(const tabla of tablas){

            const resultado =
                await consultarUno(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM "${tabla}"
                    `
                );

            conteos.push({

                tabla,

                registros:
                    Number(
                        resultado?.total
                        || 0
                    )

            });

        }

        console.log(
            "\nCantidad de registros:"
        );

        console.table(
            conteos
        );


        const estados =
            await consultarTodos(
                `
                SELECT
                    estado,
                    COUNT(*) AS total

                FROM turnos

                GROUP BY estado

                ORDER BY estado
                `
            );

        console.log(
            "\nTurnos por estado:"
        );

        console.table(
            estados
        );


        const reglasHuerfanas =
            await consultarTodos(
                `
                SELECT
                    rm.tramite,
                    rm.mesa,
                    rm.tipo,
                    rm.orden,

                    CASE
                        WHEN tc.codigo IS NULL
                        THEN 'Trámite inexistente'
                        WHEN mc.numero IS NULL
                        THEN 'Mesa inexistente'
                        ELSE 'Correcta'
                    END AS problema

                FROM reglas_mesas rm

                LEFT JOIN tramites_config tc
                    ON tc.codigo=rm.tramite

                LEFT JOIN mesas_config mc
                    ON mc.numero=rm.mesa

                WHERE
                    tc.codigo IS NULL
                    OR mc.numero IS NULL

                ORDER BY
                    rm.tramite,
                    rm.tipo,
                    rm.orden
                `
            );

        console.log(
            "\nReglas huérfanas:"
        );

        if(reglasHuerfanas.length){

            console.table(
                reglasHuerfanas
            );

        }else{

            console.log(
                "Ninguna."
            );

        }


        const mesasMultiples =
            await consultarTodos(
                `
                SELECT
                    mesa,
                    COUNT(*) AS total

                FROM turnos

                WHERE estado='atendiendo'

                GROUP BY mesa

                HAVING COUNT(*) > 1
                `
            );

        console.log(
            "\nMesas con más de un turno en atención:"
        );

        if(mesasMultiples.length){

            console.table(
                mesasMultiples
            );

        }else{

            console.log(
                "Ninguna."
            );

        }


        const codigosDuplicados =
            await consultarTodos(
                `
                SELECT
                    codigo,
                    date(
                        fechaCreacion,
                        'localtime'
                    ) AS fecha,
                    COUNT(*) AS total

                FROM turnos

                GROUP BY
                    codigo,
                    date(
                        fechaCreacion,
                        'localtime'
                    )

                HAVING COUNT(*) > 1

                ORDER BY total DESC
                `
            );

        console.log(
            "\nFolios duplicados en el mismo día:"
        );

        if(codigosDuplicados.length){

            console.table(
                codigosDuplicados
            );

        }else{

            console.log(
                "Ninguno."
            );

        }


        const configuracionesDuplicadas =
            await consultarTodos(
                `
                SELECT
                    clave,
                    COUNT(*) AS total

                FROM configuracion_sistema

                GROUP BY clave

                HAVING COUNT(*) > 1
                `
            );

        console.log(
            "\nConfiguraciones duplicadas:"
        );

        if(
            configuracionesDuplicadas.length
        ){

            console.table(
                configuracionesDuplicadas
            );

        }else{

            console.log(
                "Ninguna."
            );

        }

        const detalleDuplicados =
            await consultarTodos(
                `
                SELECT
                    id,
                    codigo,
                    tramite,
                    estado,
                    mesa,
                    fechaCreacion,
                    fechaLlamado,
                    fechaFinalizado,
                    observaciones

                FROM turnos

                WHERE codigo IN (
                    'CA001',
                    'CA002'
                )
                AND date(
                    fechaCreacion,
                    'localtime'
                ) = '2026-07-14'

                ORDER BY
                    codigo ASC,
                    id ASC
                `
            );

        console.log(
            "\nDetalle de folios duplicados:"
        );

        console.table(
            detalleDuplicados
        );

        console.log(
            "\nInspección terminada correctamente."
        );

    }catch(error){

        console.error(
            "\nLa inspección falló:",
            error
        );

        process.exitCode =
            1;

    }finally{

        db.close(
            error => {

                if(error){

                    console.error(
                        "No se pudo cerrar la base:",
                        error
                    );

                }

            }
        );

    }

}


inspeccionar();