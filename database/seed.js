const db = require("./db");

const tramites = [
    ["A", "Atención General"],
    ["B", "Convenios"],
    ["C", "Pagos"],
    ["D", "Contratos"],
    ["E", "Aclaraciones"]
];

tramites.forEach(t => {

    db.run(
        "INSERT INTO tramites (letra, nombre) VALUES (?, ?)",
        t
    );

});

console.log("Trámites insertados");