&#x20;# Historial de cambios — LINK Kiosco de Turnos



Todas las modificaciones relevantes del producto serán documentadas en este archivo.



El proyecto utiliza versionado semántico:



\- Versión mayor: cambios importantes o incompatibles.

\- Versión menor: nuevas funcionalidades compatibles.

\- Versión de parche: mejoras y correcciones compatibles.



\---



\## \[1.0.1] - En desarrollo



\### Agregado



\- Botón «Volver a llamar» en la interfaz de Mesa.

\- Reemisión del último turno atendido por la mesa.

\- Actualización inmediata de la pantalla sin generar un turno nuevo.

\- Conservación del código, trámite, mesa y estado del turno original.

\- Reproducción nuevamente del sonido, voz y animación.

\- Validación del turno actual directamente en el servidor.

\- Prevención de registros duplicados en «Últimos turnos».



\### Seguridad funcional



\- La repetición no debe avanzar la fila de espera.

\- La repetición no debe crear un registro nuevo.

\- La repetición no debe asignar un turno diferente.

\- Solo se puede repetir el último turno llamado por esa mesa.

\- No genera un turno nuevo.

\- No modifica la fila de espera.

\- No cambia el estado del turno.

\- No altera las estadísticas.

\- No permite repetir un turno que ya fue finalizado o liberado.



\---



\## \[1.0.0] - 2026-07-21



\### Agregado



\- Primera versión estable de LINK Kiosco de Turnos.

\- Aplicación de escritorio creada con Electron.

\- Servidor local con Node.js, Express y Socket.IO.

\- Base de datos SQLite persistente.

\- Interfaces de Administración, Supervisor y Recepción.

\- Gestión de mesas, trámites, usuarios y reglas de asignación.

\- Pantalla pública de turnos.

\- Respaldos locales.

\- Instalador de Windows con NSIS.

\- Datos persistentes almacenados fuera de la instalación.

\- Identidad universal de producto LINK.

