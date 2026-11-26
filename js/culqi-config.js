// Grinser · configuración de Culqi (pasarela de pago).
// 1. Entra a tu CulqiPanel → «Desarrollo» → «API Keys» y copia tu LLAVE PÚBLICA (pk_test_… o pk_live_…).
// 2. Pégala en «publicKey». La llave pública puede estar en la página; la LLAVE SECRETA (sk_…) NUNCA va aquí.
// 3. Mientras «publicKey» esté vacía, el checkout funciona en modo demostración: registra el pedido
//    como «pago de prueba» sin cobrar nada.
window.GRINSER_CULQI = {
  publicKey: 'pk_test_YhL3FgK5y6PetEHW',
  // Métodos que se muestran dentro de la ventana de Culqi. Culqi solo muestra Yape si el checkout recibe una
  // «orden»: el Apps Script la crea con la llave secreta antes de abrir la ventana. Billetera, banca móvil,
  // agentes y Cuotéalo están apagados porque el cobro de esos medios aún no está implementado.
  paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
  // Yape acepta como máximo S/ 2 000 por pago (límite de Culqi).
  yapeMax: 2000,
};
