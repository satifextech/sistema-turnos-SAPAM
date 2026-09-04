# LINK Platform

## Documento maestro del producto

**Producto:** LINK Kiosco de Turnos  
**Descripción:** Kiosco de Turnos Universal  
**Empresa:** LINK  
**App ID:** com.link.kiosco.turnos  
**Versión base:** 1.0.1 Echo  
**Inicio de LINK Platform:** 21 de julio de 2026  

---

## 1. Propósito

LINK Platform convierte LINK Kiosco de Turnos en un producto comercial,
administrable, actualizable, licenciable y documentado profesionalmente.

---

## 2. Principio fundamental

La operación diaria de los turnos nunca dependerá de Internet.

Los turnos, configuraciones operativas y datos locales continuarán funcionando
mediante el servidor local, SQLite, Express y Socket.IO.

Internet se utilizará únicamente para servicios complementarios como:

- licenciamiento;
- actualizaciones;
- administración remota;
- soporte;
- consulta de versiones;
- configuración centralizada.

---

## 3. Arquitectura general

### Aplicación local

- LINK Kiosco de Turnos
- Electron
- Node.js
- Express
- Socket.IO
- SQLite
- Interfaces web para recepción, mesas, pantalla y administración

### Plataforma remota futura

- LINK Cloud
- Portal LINK
- LINK Agent
- LINK Update
- Sistema de licencias

---

## 4. Módulos de LINK Platform

### 12.1 LINK Identity

Identidad, versión, información del producto, metadatos, copyright,
pantalla Acerca de e integración visual.

### 12.2 LINK License

Activación, renovación, licencia anual, licencia permanente, periodo de gracia,
suspensión y validación local.

### 12.3 LINK Hardware Identity

Identificador estable del equipo y vinculación segura de la licencia.

### 12.4 LINK Cloud

Administración centralizada de clientes, licencias, versiones y configuraciones.

### 12.5 Portal LINK

Interfaz administrativa para LINK.

### 12.6 LINK Agent

Comunicación controlada entre la aplicación local y LINK Cloud.

### 12.7 LINK Update

Consulta, descarga, validación e instalación segura de actualizaciones.

### 12.8 LINK Security

Integridad, firmas, secretos, controles de acceso y protección del producto.

### 12.9 Documentación

Manual técnico, instalación, usuario, arquitectura, seguridad, licencias,
operación y liberaciones.

### 12.10 Release 2.0

Primera liberación completa de LINK Platform.

---

## 5. Reglas de desarrollo

1. La operación local no dependerá de Internet.
2. Los datos del cliente permanecerán locales salvo autorización explícita.
3. Ningún cambio podrá romper una instalación existente.
4. Las actualizaciones conservarán base de datos, usuarios y configuración.
5. Cada módulo deberá quedar funcional, probado y documentado.
6. Las versiones seguirán versionado semántico.
7. La identidad del producto tendrá una única fuente de verdad.
8. No se incluirán referencias de clientes dentro de la marca universal LINK.
9. Los secretos y credenciales no se almacenarán en el repositorio.
10. Cada versión comercial tendrá un procedimiento de liberación reproducible.

---

## 6. Versionado

Formato:

`MAYOR.MENOR.PARCHE`

- MAYOR: cambios incompatibles o nueva generación.
- MENOR: nuevas funciones compatibles.
- PARCHE: correcciones y mejoras compatibles.

Versión actual:

`1.0.1 Echo`

---

## 7. Estado

- Aplicación local: funcional.
- Electron: funcional.
- Instalador: funcional.
- Red local: validada.
- Actualización 1.0.1: en desarrollo.
- LINK Identity: en desarrollo.
- LINK License: pendiente.
- LINK Cloud: pendiente.
- Portal LINK: pendiente.
- LINK Agent: pendiente.
- LINK Update: pendiente.
