const SHEETS = {
  products: 'Productos',
  categories: 'Categorias',
  clients: 'Clientes',
  users: 'Usuarios',
  events: 'Eventos',
  orders: 'Pedidos',
};
// Pagos con Culqi: la LLAVE SECRETA (sk_test_… / sk_live_…) se guarda en
// Configuración del proyecto → Propiedades del script → CULQI_SECRET_KEY. Nunca en la página web.
const CULQI_SECRET_PROPERTY = 'CULQI_SECRET_KEY';
const CULQI_CHARGES_URL = 'https://api.culqi.com/v2/charges';
const ORDER_HEADERS = [
  'id', 'fecha', 'estado', 'cliente', 'dni', 'telefono', 'email', 'direccion', 'comprobante',
  'ruc', 'razon_social', 'items', 'total', 'metodo', 'culqi_cargo', 'notas',
];
const ADMIN_KEY_PROPERTY = 'GRINSER_ADMIN_KEY';

const PRODUCT_HEADERS = [
  'id', 'nombre', 'categoria', 'marca', 'precio', 'precio_oferta',
  'stock', 'descripcion', 'imagen', 'activo',
  // Columnas añadidas para la ficha del producto (las listas se guardan como JSON).
  'sku', 'imagenes', 'especificaciones', 'garantia',
];
const MAX_EXTRA_IMAGES = 8;
const MAX_SPECS = 40;

// Lee una lista guardada como JSON en una celda; si la celda está vacía o dañada, devuelve [].
function parseList_(value) {
  if (Array.isArray(value)) return value;
  const text = String(value == null ? '' : value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function cleanImages_(list) {
  return parseList_(list).map((url) => String(url || '').trim())
    .filter((url) => url && url.length <= 2000 && !/^\s*(javascript|vbscript|data):/i.test(url))
    .slice(0, MAX_EXTRA_IMAGES);
}

function cleanSpecs_(list) {
  return parseList_(list).map((spec) => ({
    grupo: String(spec && spec.grupo || '').trim().slice(0, 60),
    nombre: String(spec && spec.nombre || '').trim().slice(0, 80),
    valor: String(spec && spec.valor || '').trim().slice(0, 300),
  })).filter((spec) => spec.nombre && spec.valor).slice(0, MAX_SPECS);
}
const CATEGORY_HEADERS = ['id', 'nombre', 'icon'];
const CLIENT_HEADERS = ['id', 'nombre', 'email', 'telefono', 'creado'];
const USER_HEADERS = ['id', 'nombre', 'email', 'telefono', 'password_salt', 'password_hash', 'rol', 'activo', 'creado'];
const EVENT_HEADERS = ['id', 'habilitado', 'modo', 'evento_manual'];
const DEFAULT_EVENT_MODE = 'automatic';
const DEFAULT_MANUAL_EVENT = 'navidad';

const DEFAULT_EVENTS = [
  ['navidad', true],
  ['ano_nuevo', true],
  ['fiestas_patrias', true],
];
const DEFAULT_EVENT_ROWS = [
  ['config', '', DEFAULT_EVENT_MODE, DEFAULT_MANUAL_EVENT],
  ...DEFAULT_EVENTS.map(([id, enabled]) => [id, enabled, '', '']),
];

const DEFAULT_CATEGORIES = [
  ['fotocopiadoras', 'Fotocopiadoras', 'copier'],
  ['toner', 'Tóner y recargas', 'drop'],
  ['repuestos', 'Repuestos', 'wrench'],
  ['plotter', 'Plotter', 'printer'],
  ['papeleria', 'Papel y accesorios', 'file'],
];

const DEFAULT_PRODUCTS = [
  ['p-005', 'Fotocopiadora bizhub C250i', 'fotocopiadoras', 'Konica Minolta', 12900, '', 2, 'Color A3, 25 ppm, panel táctil y seguridad empresarial.', '', true],
  ['p-007', 'Botella de tinta 544 negra', 'toner', 'Epson', 45, 39, 60, 'Tinta original de 65 ml, rinde hasta 4 500 páginas.', '', true],
  ['p-010', 'Unidad de imagen (drum) DR-2340', 'repuestos', 'Brother', 349, 315, 7, 'Tambor original, hasta 12 000 páginas.', '', true],
  ['p-011', 'Kit de fusor para MP 2554', 'repuestos', 'Ricoh', 780, '', 4, 'Repuesto original. Incluye instalación con nuestro servicio técnico.', '', true],
  ['p-012', 'Papel bond A4 75 g (paquete x 500)', 'papeleria', 'Surco', 21.9, 19.5, 150, 'Blancura alta, ideal para impresión láser y fotocopiado.', '', true],
];

function setupGrinserSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Vincula este proyecto a una hoja de cálculo antes de ejecutar la configuración.');
  ensureSheet_(spreadsheet, SHEETS.products, PRODUCT_HEADERS, DEFAULT_PRODUCTS.map((row) => row.concat(['', '[]', '[]', ''])));
  ensureSheet_(spreadsheet, SHEETS.categories, CATEGORY_HEADERS, DEFAULT_CATEGORIES);
  ensureSheet_(spreadsheet, SHEETS.clients, CLIENT_HEADERS, []);
  ensureSheet_(spreadsheet, SHEETS.users, USER_HEADERS, []);
  ensureSheet_(spreadsheet, SHEETS.events, EVENT_HEADERS, DEFAULT_EVENT_ROWS);
  ensureSheet_(spreadsheet, SHEETS.orders, ORDER_HEADERS, []);
  spreadsheet.setSpreadsheetTimeZone('America/Lima');
  console.log('Pestañas Productos, Categorias, Clientes, Usuarios, Eventos y Pedidos preparadas.');
}

function ensureSheet_(spreadsheet, name, headers, seedRows) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (seedRows.length) sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
}

function doGet(event) {
  const callback = event && event.parameter && event.parameter.callback;
  const catalog = readCatalog_();
  const json = JSON.stringify({
    ok: true,
    products: catalog.products,
    categories: catalog.categories,
    events: catalog.eventConfig.events,
    eventMode: catalog.eventConfig.mode,
    manualEventId: catalog.eventConfig.manualEventId,
  });
  if (callback) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
      return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
    }
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function readCatalog_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('No hay una hoja vinculada a este proyecto.');
  return {
    products: readRows_(spreadsheet, SHEETS.products, PRODUCT_HEADERS).map((row) => ({
      id: String(row.id || ''),
      nombre: String(row.nombre || ''),
      categoria: String(row.categoria || ''),
      marca: String(row.marca || ''),
      precio: Number(row.precio) || 0,
      precio_oferta: row.precio_oferta === '' || row.precio_oferta == null ? null : Number(row.precio_oferta),
      stock: Number(row.stock) || 0,
      descripcion: String(row.descripcion || ''),
      imagen: String(row.imagen || ''),
      activo: row.activo === true || String(row.activo).toLowerCase() === 'true',
      sku: String(row.sku || ''),
      imagenes: cleanImages_(row.imagenes),
      especificaciones: cleanSpecs_(row.especificaciones),
      garantia: String(row.garantia || ''),
    })).filter((product) => product.id && product.nombre),
    categories: readRows_(spreadsheet, SHEETS.categories, CATEGORY_HEADERS).map((row) => ({
      id: String(row.id || ''),
      nombre: String(row.nombre || ''),
      icon: String(row.icon || 'box'),
    })).filter((category) => category.id && category.nombre),
    eventConfig: readEvents_(spreadsheet),
  };
}

function readEvents_(spreadsheet) {
  const defaults = DEFAULT_EVENTS.map(([id, enabled]) => ({ id: id, enabled: enabled }));
  const sheet = spreadsheet.getSheetByName(SHEETS.events);
  if (!sheet || sheet.getLastRow() < 2) {
    return { events: defaults, mode: DEFAULT_EVENT_MODE, manualEventId: DEFAULT_MANUAL_EVENT };
  }
  const rows = readRows_(spreadsheet, SHEETS.events, EVENT_HEADERS);
  const saved = new Map(rows.filter((row) => row.id !== 'config').map((row) => [String(row.id || ''), row.habilitado]));
  const config = rows.find((row) => row.id === 'config');
  const knownManualEvent = DEFAULT_EVENTS.some(([id]) => id === String(config && config.evento_manual || ''));
  return {
    events: defaults.map((event) => ({
      id: event.id,
      enabled: saved.has(event.id)
        ? saved.get(event.id) === true || String(saved.get(event.id)).toLowerCase() === 'true'
        : event.enabled,
    })),
    mode: config && config.modo === 'manual' ? 'manual' : DEFAULT_EVENT_MODE,
    manualEventId: knownManualEvent ? String(config.evento_manual) : DEFAULT_MANUAL_EVENT,
  };
}

function readRows_(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map((valuesRow) => headers.reduce((row, header, index) => {
    row[header] = valuesRow[index];
    return row;
  }, {}));
}

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const nonce = /^[A-Za-z0-9_-]{12,100}$/.test(parameters.nonce || '') ? parameters.nonce : '';
  try {
    if (parameters.action === 'register-client') return registerClient_(parameters, nonce);
    if (parameters.action === 'user-auth-challenge') {
      return registrationResult_(nonce, true, 'Desafío de autenticación.', { salt: userSalt_(parameters.email) });
    }
    if (parameters.action === 'register-user') return registerUser_(parameters, nonce);
    if (parameters.action === 'login-user') return loginUser_(parameters, nonce);
    if (parameters.action === 'list-users') {
      verifyAdminKey_(parameters.adminKey);
      return registrationResult_(nonce, true, 'Usuarios cargados.', { users: listUsers_() });
    }
    if (parameters.action === 'admin-create-user') {
      verifyAdminKey_(parameters.adminKey);
      const user = createUserRecord_(parameters, String(parameters.rol || 'cliente'));
      return registrationResult_(nonce, true, 'Usuario creado.', { user: publicUser_(user) });
    }
    if (parameters.action === 'update-user') {
      verifyAdminKey_(parameters.adminKey);
      const result = updateUserRecord_(parameters);
      return registrationResult_(nonce, true, 'Usuario actualizado.', result);
    }
    if (parameters.action === 'culqi-order') return createCulqiOrder_(parameters, nonce);
    if (parameters.action === 'culqi-charge') return chargeWithCulqi_(parameters, nonce);
    if (parameters.action === 'upload-image') {
      verifyAdminKey_(parameters.adminKey);
      const image = uploadProductImage_(parameters);
      return registrationResult_(nonce, true, 'Imagen subida.', image);
    }
    if (parameters.action === 'save-events') {
      verifyAdminKey_(parameters.adminKey);
      const configuration = validateEvents_(JSON.parse(parameters.events || '{}'));
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        writeEvents_(configuration);
      } finally {
        lock.releaseLock();
      }
      SpreadsheetApp.flush();
      return registrationResult_(nonce, true, 'Eventos sincronizados.');
    }
    if (parameters.action === 'save-catalog') {
      verifyAdminKey_(parameters.adminKey);
      const catalog = validateCatalog_(JSON.parse(parameters.catalog || '{}'));
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        writeCatalog_(catalog);
      } finally {
        lock.releaseLock();
      }
      SpreadsheetApp.flush();
      return registrationResult_(nonce, true, 'Catálogo sincronizado.');
    }
    throw new Error('Solicitud no reconocida.');
  } catch (error) {
    console.error(error);
    return registrationResult_(nonce, false, error.message || 'No se pudo guardar el registro.');
  }
}

function registerClient_(parameters, nonce) {
  if (parameters.website) throw new Error('No se pudo procesar el registro.');
  const name = String(parameters.nombre || '').trim();
  const email = String(parameters.email || '').trim().toLowerCase();
  const phone = String(parameters.telefono || '').trim();
  if (name.length < 3 || name.length > 80) throw new Error('Escribe un nombre válido.');
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Escribe un correo válido.');
  if (phone.length > 20 || (phone && !/^[0-9+()\s.-]{7,20}$/.test(phone))) throw new Error('Escribe un teléfono válido.');

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet && spreadsheet.getSheetByName(SHEETS.clients);
  if (!sheet) throw new Error('Falta la pestaña Clientes. Ejecuta setupGrinserSheets().');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const lastRow = sheet.getLastRow();
    const columnByHeader = {};
    for (let column = 1; column <= sheet.getLastColumn(); column += 1) {
      const header = String(sheet.getRange(1, column).getDisplayValue() || '').trim().toLowerCase();
      if (header) {
        if (columnByHeader[header]) throw new Error('La pestaña Clientes tiene encabezados duplicados.');
        columnByHeader[header] = column;
      }
    }
    ['nombre', 'email', 'telefono', 'creado'].forEach((header) => {
      if (!columnByHeader[header]) {
        throw new Error('La pestaña Clientes debe tener las columnas nombre, email, telefono y creado.');
      }
    });

    const rowCount = Math.max(0, lastRow - 1);
    const valuesByHeader = {};
    Object.keys(columnByHeader).forEach((header) => {
      if (['id', 'nombre', 'email', 'telefono', 'creado'].includes(header)) {
        valuesByHeader[header] = rowCount
          ? sheet.getRange(2, columnByHeader[header], rowCount, 1).getValues().map((row) => row[0])
          : [];
      }
    });
    const matchingIndex = valuesByHeader.email.findIndex((value) => String(value || '').trim().toLowerCase() === email);
    const shiftedIndex = matchingIndex < 0 && columnByHeader.id
      ? valuesByHeader.nombre.findIndex((value, index) => {
        const displacedPhone = String(valuesByHeader.email[index] || '').trim();
        const displacedDate = String(valuesByHeader.telefono[index] || '').trim();
        const createdValue = String(valuesByHeader.creado[index] || '').trim();
        return String(value || '').trim().toLowerCase() === email &&
          String(valuesByHeader.id[index] || '').trim() &&
          (!displacedPhone || /^[0-9+()\s.-]{7,20}$/.test(displacedPhone)) &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(displacedDate) &&
          !createdValue;
      })
      : -1;
    const rowIndex = matchingIndex >= 0 ? matchingIndex : shiftedIndex;
    const rowNumber = rowIndex >= 0 ? rowIndex + 2 : lastRow + 1;
    const wasShifted = shiftedIndex >= 0;
    const created = rowIndex >= 0
      ? (wasShifted ? valuesByHeader.telefono[rowIndex] : valuesByHeader.creado[rowIndex]) || new Date().toISOString()
      : new Date().toISOString();
    const id = columnByHeader.id
      ? (wasShifted ? Utilities.getUuid() : valuesByHeader.id[rowIndex] || Utilities.getUuid())
      : '';
    const savedPhone = wasShifted && !phone ? String(valuesByHeader.email[rowIndex] || '') : phone;
    writeClientRow_(sheet, columnByHeader, rowNumber, { id, name, email, phone: savedPhone, created });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return registrationResult_(nonce, true, 'Registro guardado.');
}

function userSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet && spreadsheet.getSheetByName(SHEETS.users);
  if (!sheet) throw new Error('Falta la pestaña Usuarios. Ejecuta setupGrinserSheets() y vuelve a implementar la aplicación.');
  return sheet;
}

function createUserRecord_(parameters, role) {
  const name = String(parameters.nombre || '').trim();
  const email = String(parameters.email || '').trim().toLowerCase();
  const phone = String(parameters.telefono || '').trim();
  const passwordSalt = String(parameters.passwordSalt || '');
  const passwordHash = String(parameters.passwordHash || '');
  if (name.length < 3 || name.length > 80) throw new Error('Escribe un nombre válido.');
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Escribe un correo válido.');
  if (phone.length > 20 || (phone && !/^[0-9+()\s.-]{7,20}$/.test(phone))) throw new Error('Escribe un teléfono válido.');
  if (!/^[a-f0-9]{32}$/i.test(passwordSalt) || !/^[a-f0-9]{64}$/i.test(passwordHash)) {
    throw new Error('No se pudieron validar las credenciales de la cuenta.');
  }
  if (role !== 'admin' && role !== 'cliente') throw new Error('El rol del usuario no es válido.');

  const sheet = userSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const lastRow = sheet.getLastRow();
    const users = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, USER_HEADERS.length).getValues();
    if (users.some((row) => String(row[2] || '').trim().toLowerCase() === email)) {
      throw new Error('Ese correo ya está registrado.');
    }
    const user = {
      id: Utilities.getUuid(), nombre: name, email, telefono: phone,
      password_salt: passwordSalt, password_hash: passwordHash, rol: role, activo: true,
      creado: new Date().toISOString(),
    };
    sheet.appendRow(USER_HEADERS.map((header) => user[header]));
    return user;
  } finally {
    lock.releaseLock();
  }
}

function registerUser_(parameters, nonce) {
  const user = createUserRecord_(parameters, 'cliente');
  return registrationResult_(nonce, true, 'Cuenta creada.', { user: publicUser_(user) });
}

function loginUser_(parameters, nonce) {
  const email = String(parameters.email || '').trim().toLowerCase();
  const passwordSalt = String(parameters.passwordSalt || '');
  const passwordHash = String(parameters.passwordHash || '');
  const sheet = userSheet_();
  const lastRow = sheet.getLastRow();
  const users = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, USER_HEADERS.length).getValues();
  const row = users.find((user) => String(user[2] || '').trim().toLowerCase() === email);
  if (!row) return registrationResult_(nonce, true, 'Cuenta no encontrada.', { found: false });
  if (!constantTimeEqual_(String(row[4] || ''), passwordSalt)
      || !constantTimeEqual_(String(row[5] || ''), passwordHash)) {
    throw new Error('Correo o contraseña incorrectos.');
  }
  const user = userFromRow_(row);
  if (!user.activo) throw new Error('Tu cuenta está desactivada. Comunícate con Grinser.');
  return registrationResult_(nonce, true, 'Inicio de sesión correcto.', { found: true, user: publicUser_(user) });
}

function userSalt_(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const sheet = userSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const users = sheet.getRange(2, 1, lastRow - 1, USER_HEADERS.length).getValues();
    const user = users.find((row) => String(row[2] || '').trim().toLowerCase() === normalizedEmail);
    if (user && /^[a-f0-9]{32}$/i.test(String(user[4] || ''))) return String(user[4]);
  }
  return Utilities.getUuid().replace(/-/g, '');
}

function userFromRow_(row) {
  return USER_HEADERS.reduce((user, header, index) => {
    user[header] = row[index];
    return user;
  }, {});
}

function publicUser_(user) {
  return {
    id: String(user.id), nombre: String(user.nombre), email: String(user.email),
    telefono: String(user.telefono || ''), rol: String(user.rol || 'cliente'),
    activo: user.activo === true || String(user.activo).toLowerCase() === 'true',
    creado: String(user.creado || ''),
  };
}

function listUsers_() {
  const sheet = userSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, USER_HEADERS.length).getValues()
    .map(userFromRow_).map(publicUser_);
}

function updateUserRecord_(parameters) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return updateUserRecordLocked_(parameters);
  } finally {
    lock.releaseLock();
  }
}

function updateUserRecordLocked_(parameters) {
  const id = String(parameters.id || '');
  const change = JSON.parse(parameters.change || '{}');
  const sheet = userSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !id) throw new Error('No se encontró el usuario.');
  const rows = sheet.getRange(2, 1, lastRow - 1, USER_HEADERS.length).getValues();
  const index = rows.findIndex((row) => String(row[0]) === id);
  if (index < 0) throw new Error('No se encontró el usuario.');
  const row = rows[index];
  if (change.delete === true) {
    const activeAdmins = rows.filter((item) =>
      String(item[6]) === 'admin' && (item[7] === true || String(item[7]).toLowerCase() === 'true')).length;
    if (String(row[6]) === 'admin' && (row[7] === true || String(row[7]).toLowerCase() === 'true') && activeAdmins <= 1) {
      throw new Error('Debe quedar al menos un administrador activo.');
    }
    sheet.deleteRow(index + 2);
    return { deleted: true };
  }
  if (change.rol != null && change.rol !== 'admin' && change.rol !== 'cliente') {
    throw new Error('El rol del usuario no es válido.');
  }
  if (change.activo != null && typeof change.activo !== 'boolean') {
    throw new Error('El estado del usuario no es válido.');
  }
  const nextRole = change.rol == null ? String(row[6]) : change.rol;
  const nextActive = change.activo == null
    ? row[7] === true || String(row[7]).toLowerCase() === 'true'
    : change.activo;
  const removesActiveAdmin = String(row[6]) === 'admin' && (nextRole !== 'admin' || !nextActive);
  if (removesActiveAdmin) {
    const activeAdmins = rows.filter((item) =>
      String(item[6]) === 'admin' && (item[7] === true || String(item[7]).toLowerCase() === 'true')).length;
    if (activeAdmins <= 1) throw new Error('Debe quedar al menos un administrador activo.');
  }
  if (change.rol != null) sheet.getRange(index + 2, 7).setValue(change.rol);
  if (change.activo != null) sheet.getRange(index + 2, 8).setValue(change.activo);
  return { user: publicUser_(userFromRow_(sheet.getRange(index + 2, 1, 1, USER_HEADERS.length).getValues()[0])) };
}

function constantTimeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function writeClientRow_(sheet, columnByHeader, rowNumber, client) {
  sheet.getRange(rowNumber, columnByHeader.email).setValue(client.email);
  if (columnByHeader.id) sheet.getRange(rowNumber, columnByHeader.id).setValue(client.id);
  sheet.getRange(rowNumber, columnByHeader.nombre).setValue(client.name);
  sheet.getRange(rowNumber, columnByHeader.telefono).setValue(client.phone);
  sheet.getRange(rowNumber, columnByHeader.creado).setValue(client.created);
}

function verifyAdminKey_(providedKey) {
  const expectedKey = PropertiesService.getScriptProperties().getProperty(ADMIN_KEY_PROPERTY);
  if (!expectedKey) throw new Error('Configura GRINSER_ADMIN_KEY en las propiedades del proyecto de Apps Script.');
  const provided = String(providedKey || '');
  if (provided.length !== expectedKey.length) throw new Error('Clave de administración incorrecta.');
  let mismatch = 0;
  for (let index = 0; index < expectedKey.length; index += 1) {
    mismatch |= expectedKey.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  if (mismatch !== 0) throw new Error('Clave de administración incorrecta.');
}

function uploadProductImage_(parameters) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const mimeType = String(parameters.mimeType || '').toLowerCase();
  const base64 = String(parameters.base64 || '');
  if (allowedTypes.indexOf(mimeType) < 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
      base64.length > 6990508) {
    throw new Error('El archivo de imagen no es válido o supera los 5 MB.');
  }
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw new Error('El archivo de imagen no es válido o supera los 5 MB.');
  }
  const filename = String(parameters.filename || 'imagen')
    .replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 100) || 'imagen';
  const file = DriveApp.createFile(Utilities.newBlob(bytes, mimeType, filename));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    url: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
  };
}

function validateCatalog_(catalog) {
  if (!catalog || !Array.isArray(catalog.categories) || !Array.isArray(catalog.products)) {
    throw new Error('El catálogo recibido no tiene el formato esperado.');
  }
  if (!catalog.categories.length || catalog.categories.length > 100 || catalog.products.length > 500) {
    throw new Error('El catálogo debe tener categorías y no superar los límites permitidos.');
  }
  const categoryIds = new Set();
  const categoryNames = new Set();
  const categories = catalog.categories.map((category) => {
    const id = String(category.id || '').trim();
    const name = String(category.nombre || '').trim();
    const icon = String(category.icon || 'box').trim();
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || name.length < 3 || name.length > 80 || !/^[a-z0-9-]{1,40}$/i.test(icon)) {
      throw new Error('Hay una categoría con datos inválidos.');
    }
    if (categoryIds.has(id) || categoryNames.has(name.toLocaleLowerCase())) {
      throw new Error('Hay categorías duplicadas.');
    }
    categoryIds.add(id);
    categoryNames.add(name.toLocaleLowerCase());
    return { id: id, nombre: name, icon: icon };
  });
  const productIds = new Set();
  const products = catalog.products.map((product) => {
    const id = String(product.id || '').trim();
    const name = String(product.nombre || '').trim();
    const category = String(product.categoria || '').trim();
    const brand = String(product.marca || '').trim();
    const description = String(product.descripcion || '').trim();
    const image = String(product.imagen || '').trim();
    const price = Number(product.precio);
    const offer = product.precio_oferta == null || product.precio_oferta === '' ? null : Number(product.precio_oferta);
    const stock = Number(product.stock);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || name.length < 3 || name.length > 120 ||
        (!categoryIds.has(category) && category !== 'impresoras') || brand.length > 80 ||
        description.length > 1500 || image.length > 2000 || /^\s*(javascript|vbscript):/i.test(image) ||
        !(price > 0) || !Number.isFinite(price) || (offer != null && (!(offer > 0) || offer >= price || !Number.isFinite(offer))) ||
        !Number.isInteger(stock) || stock < 0 || typeof product.activo !== 'boolean') {
      throw new Error('Hay un producto con datos inválidos.');
    }
    if (productIds.has(id)) throw new Error('Hay identificadores de producto duplicados.');
    productIds.add(id);
    const sku = String(product.sku || '').trim();
    const warranty = String(product.garantia || '').trim();
    if (sku.length > 40 || warranty.length > 300) throw new Error('Hay un producto con SKU o garantía demasiado largos.');
    return {
      id: id, nombre: name, categoria: category, marca: brand, precio: price,
      precio_oferta: offer, stock: stock, descripcion: description, imagen: image, activo: product.activo,
      sku: sku, imagenes: cleanImages_(product.imagenes), especificaciones: cleanSpecs_(product.especificaciones), garantia: warranty,
    };
  });
  return { categories: categories, products: products };
}

function validateEvents_(configuration) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    throw new Error('La configuración de eventos no tiene el formato esperado.');
  }
  const events = configuration.events;
  if (!Array.isArray(events) || events.length !== DEFAULT_EVENTS.length) {
    throw new Error('La configuración de eventos no tiene el formato esperado.');
  }
  const enabledById = new Map();
  events.forEach((event) => {
    if (!event || typeof event !== 'object') {
      throw new Error('Hay una configuración de evento inválida.');
    }
    const id = String(event && event.id || '');
    if (!DEFAULT_EVENTS.some(([knownId]) => knownId === id) || typeof event.enabled !== 'boolean' || enabledById.has(id)) {
      throw new Error('Hay una configuración de evento inválida.');
    }
    enabledById.set(id, event.enabled);
  });
  const normalizedEvents = DEFAULT_EVENTS.map(([id]) => {
    if (!enabledById.has(id)) throw new Error('Falta la configuración de un evento.');
    return { id: id, enabled: enabledById.get(id) };
  });
  const mode = configuration.mode;
  const manualEventId = String(configuration.manualEventId || '');
  if (mode !== 'automatic' && mode !== 'manual') {
    throw new Error('El modo de activación de eventos no es válido.');
  }
  if (!DEFAULT_EVENTS.some(([id]) => id === manualEventId)) {
    throw new Error('El evento seleccionado para el modo manual no es válido.');
  }
  if (mode === 'manual' && !enabledById.get(manualEventId)) {
    throw new Error('Habilita el evento seleccionado antes de mostrarlo manualmente.');
  }
  return { events: normalizedEvents, mode: mode, manualEventId: manualEventId };
}

function writeEvents_(configuration) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('No hay una hoja vinculada a este proyecto.');
  ensureSheet_(spreadsheet, SHEETS.events, EVENT_HEADERS, DEFAULT_EVENT_ROWS);
  const rows = [
    ['config', '', configuration.mode, configuration.manualEventId],
    ...configuration.events.map((event) => [event.id, event.enabled, '', '']),
  ];
  replaceSheet_(spreadsheet, SHEETS.events, EVENT_HEADERS, rows, [1, 3, 4]);
}

function writeCatalog_(catalog) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('No hay una hoja vinculada a este proyecto.');
  replaceSheet_(spreadsheet, SHEETS.categories, CATEGORY_HEADERS, catalog.categories.map((category) => [
    category.id, category.nombre, category.icon,
  ]), [1, 2, 3]);
  replaceSheet_(spreadsheet, SHEETS.products, PRODUCT_HEADERS, catalog.products.map((product) => [
    product.id, product.nombre, product.categoria, product.marca, product.precio,
    product.precio_oferta == null ? '' : product.precio_oferta, product.stock,
    product.descripcion, product.imagen, product.activo,
    product.sku || '', JSON.stringify(product.imagenes || []),
    JSON.stringify(product.especificaciones || []), product.garantia || '',
  ]), [1, 2, 3, 4, 8, 9, 11, 12, 13, 14]);
}

function replaceSheet_(spreadsheet, name, headers, rows, textColumns) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('Falta la pestaña ' + name + '. Ejecuta setupGrinserSheets().');
  sheet.getDataRange().clearContent();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!rows.length) return;
  textColumns.forEach((column) => sheet.getRange(2, column, rows.length, 1).setNumberFormat('@'));
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

// ── Pagos con Culqi ──────────────────────────────────────────────────────
// 1. «culqi-order»: antes de abrir el checkout se crea una ORDEN en Culqi. Sin orden, Culqi solo
//    muestra tarjeta; con orden habilita Yape y los demás medios.
// 2. «culqi-charge»: con el token que entrega el checkout (tarjeta o Yape) se crea el CARGO.
//    Si Culqi devuelve la orden ya pagada, se verifica su estado en Culqi antes de registrar el pedido.
// El monto siempre se recalcula aquí con los precios y el stock de la hoja: no se confía en el navegador.
const CULQI_ORDERS_URL = 'https://api.culqi.com/v2/orders';

function culqiSecret_() {
  const secretKey = String(PropertiesService.getScriptProperties().getProperty(CULQI_SECRET_PROPERTY) || '').trim();
  if (!/^sk_(test|live)_/.test(secretKey)) {
    throw new Error('Pagos no configurados: agrega CULQI_SECRET_KEY en las propiedades del proyecto de Apps Script.');
  }
  return secretKey;
}

function culqiRequest_(method, url, secretKey, body) {
  const response = UrlFetchApp.fetch(url, {
    method: method,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secretKey },
    muteHttpExceptions: true,
    payload: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = JSON.parse(response.getContentText() || '{}'); } catch (error) { data = {}; }
  return { status: response.getResponseCode(), data: data, text: response.getContentText() };
}

/** Lee y valida los datos del pedido que envía el checkout. */
function readCheckout_(parameters) {
  const order = JSON.parse(parameters.pedido || '{}');
  const email = String(parameters.email || '').trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Correo no válido.');
  const client = order.cliente || {};
  const name = String(client.nombre || '').trim().slice(0, 120);
  const dni = String(client.dni || '').trim();
  const phone = String(client.telefono || '').trim();
  if (name.length < 3 || !/^\d{8}$/.test(dni) || !/^\d{9}$/.test(phone)) throw new Error('Revisa tus datos: nombre, DNI (8 dígitos) y teléfono (9 dígitos).');
  const receipt = order.comprobante || {};
  const receiptType = receipt.tipo === 'factura' ? 'factura' : 'boleta';
  if (receiptType === 'factura' && (!/^\d{11}$/.test(String(receipt.ruc || '')) || String(receipt.razon_social || '').trim().length < 3)) {
    throw new Error('Para factura indica un RUC de 11 dígitos y la razón social.');
  }
  const requested = Array.isArray(order.items) ? order.items : [];
  if (!requested.length || requested.length > 50) throw new Error('El carrito está vacío.');
  const address = order.direccion || {};
  const addressText = [address.direccion_linea1, address.distrito, address.provincia, address.departamento]
    .map((part) => String(part || '').trim()).filter(Boolean).join(', ').slice(0, 300);
  if (addressText.length < 5) throw new Error('Falta la dirección de envío.');
  const parts = name.split(/\s+/);
  return {
    order: order, email: email, name: name, dni: dni, phone: phone, receiptType: receiptType, receipt: receipt,
    requested: requested, address: address, addressText: addressText,
    firstName: parts[0], lastName: parts.slice(1).join(' ') || parts[0],
  };
}

/** Precio final y stock de cada producto pedido, según la hoja. */
function priceLines_(rows, requested) {
  const lines = requested.map((item) => {
    const id = String(item && item.id || '');
    const quantity = Number(item && item.cantidad);
    const index = rows.findIndex((row) => String(row.id) === id);
    const row = rows[index];
    const active = row && (row.activo === true || String(row.activo).toLowerCase() === 'true');
    if (!row || !active) throw new Error('Un producto de tu carrito ya no está disponible.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Cantidad no válida.');
    const stock = Number(row.stock) || 0;
    if (stock < quantity) throw new Error(`${row.nombre} ya no tiene stock suficiente (quedan ${stock}).`);
    const price = Number(row.precio) || 0;
    const offer = row.precio_oferta === '' || row.precio_oferta == null ? null : Number(row.precio_oferta);
    const finalPrice = offer && offer > 0 && offer < price ? offer : price;
    return { id, nombre: String(row.nombre), cantidad: quantity, precio: finalPrice, rowNumber: index + 2, stock };
  });
  const total = Math.round(lines.reduce((sum, line) => sum + line.precio * line.cantidad, 0) * 100) / 100;
  const amount = Math.round(total * 100); // Culqi recibe el monto en céntimos
  if (amount < 300) throw new Error('El monto mínimo para pagar con Culqi es S/ 3.00.');
  return { lines: lines, total: total, amount: amount };
}

function checkExpectedTotal_(parameters, total) {
  const expected = Number(parameters.total);
  if (Number.isFinite(expected) && Math.abs(expected - total) > 0.009) {
    throw new Error(`Los precios cambiaron: el total actual es S/ ${total.toFixed(2)}. Revisa tu carrito y vuelve a intentarlo.`);
  }
}

const newOrderId_ = () => 'GR-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
const validOrderId_ = (value) => /^GR-[A-Z0-9]{8}$/.test(String(value || ''));

/** Crea la orden de Culqi (habilita Yape en el checkout). Devuelve { order, pedido, total }. */
function createCulqiOrder_(parameters, nonce) {
  const secretKey = culqiSecret_();
  const data = readCheckout_(parameters);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('No hay una hoja vinculada a este proyecto.');
  const priced = priceLines_(readRows_(spreadsheet, SHEETS.products, PRODUCT_HEADERS), data.requested);
  checkExpectedTotal_(parameters, priced.total);
  const orderId = newOrderId_();
  const result = culqiRequest_('post', CULQI_ORDERS_URL, secretKey, {
    amount: priced.amount,
    currency_code: 'PEN',
    description: ('Pedido ' + orderId + ' - Grinser').slice(0, 80),
    order_number: orderId,
    client_details: { first_name: data.firstName, last_name: data.lastName, email: data.email, phone_number: '+51' + data.phone },
    expiration_date: Math.floor(Date.now() / 1000) + 60 * 60, // la orden vence en 1 hora
    metadata: { pedido: orderId, dni: data.dni },
  });
  if (result.status < 200 || result.status >= 300 || result.data.object !== 'order' || !result.data.id) {
    console.error('Culqi no creó la orden', result.status, result.text);
    throw new Error(result.data.user_message || result.data.merchant_message || 'No se pudo preparar el pago con Yape.');
  }
  return registrationResult_(nonce, true, 'Orden creada.', { order: result.data.id, pedido: orderId, total: priced.total });
}

function chargeWithCulqi_(parameters, nonce) {
  const secretKey = culqiSecret_();
  const mode = secretKey.split('_')[1];
  const token = String(parameters.token || '').trim();
  const culqiOrder = String(parameters.culqiOrder || '').trim();
  if (token) {
    if (!/^[a-z]{3}_(test|live)_[A-Za-z0-9]{6,}$/.test(token)) throw new Error('El pago no es válido. Vuelve a intentarlo.');
    // Una llave de prueba solo cobra tokens de prueba (y lo mismo en producción).
    if (token.split('_')[1] !== mode) throw new Error('El token de pago no corresponde al modo de la tienda (prueba / producción).');
  } else if (!/^ord_(test|live)_[A-Za-z0-9]{6,}$/.test(culqiOrder) || culqiOrder.split('_')[1] !== mode) {
    throw new Error('El pago no es válido. Vuelve a intentarlo.');
  }
  const data = readCheckout_(parameters);

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('No hay una hoja vinculada a este proyecto.');
  ensureSheet_(spreadsheet, SHEETS.orders, ORDER_HEADERS, []);
  const productsSheet = spreadsheet.getSheetByName(SHEETS.products);
  const ordersSheet = spreadsheet.getSheetByName(SHEETS.orders);
  if (!productsSheet) throw new Error('Falta la pestaña Productos.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const priced = priceLines_(readRows_(spreadsheet, SHEETS.products, PRODUCT_HEADERS), data.requested);
    checkExpectedTotal_(parameters, priced.total);
    const orderId = validOrderId_(parameters.pedidoId) ? String(parameters.pedidoId) : newOrderId_();
    const payment = token
      ? chargeToken_(secretKey, token, priced, orderId, data)
      : verifyPaidOrder_(secretKey, culqiOrder, priced, orderId);

    // Un mismo pago no se registra dos veces.
    const paymentColumn = ORDER_HEADERS.indexOf('culqi_cargo') + 1;
    const lastRow = ordersSheet.getLastRow();
    if (lastRow > 1 && ordersSheet.getRange(2, paymentColumn, lastRow - 1, 1).getValues().some((row) => String(row[0]) === payment.id)) {
      throw new Error('Este pago ya fue registrado.');
    }

    // Pago aprobado: se descuenta el stock y se guarda el pedido.
    const stockColumn = PRODUCT_HEADERS.indexOf('stock') + 1;
    priced.lines.forEach((line) => productsSheet.getRange(line.rowNumber, stockColumn).setValue(line.stock - line.cantidad));
    ordersSheet.appendRow([
      orderId, new Date().toISOString(), 'pagado', data.name, data.dni, data.phone, data.email, data.addressText, data.receiptType,
      data.receiptType === 'factura' ? String(data.receipt.ruc) : '',
      data.receiptType === 'factura' ? String(data.receipt.razon_social).trim().slice(0, 150) : '',
      priced.lines.map((line) => `${line.cantidad} x ${line.nombre} (${line.id}) @ ${line.precio.toFixed(2)}`).join(' | '),
      priced.total, payment.method, payment.id, String(data.order.notas || '').trim().slice(0, 500),
    ]);
    SpreadsheetApp.flush();
    return registrationResult_(nonce, true, 'Pago aprobado.', {
      pedido: orderId, cargo: payment.id, total: priced.total, metodo: payment.method,
      items: priced.lines.map((line) => ({ id: line.id, nombre: line.nombre, cantidad: line.cantidad, precio: line.precio })),
    });
  } finally {
    lock.releaseLock();
  }
}

/** Cobra el token (tarjeta: tkn_… / Yape: ype_…). */
function chargeToken_(secretKey, token, priced, orderId, data) {
  const result = culqiRequest_('post', CULQI_CHARGES_URL, secretKey, {
    amount: priced.amount,
    currency_code: 'PEN',
    email: data.email,
    source_id: token,
    description: ('Pedido ' + orderId + ' - Grinser').slice(0, 80),
    metadata: { pedido: orderId, dni: data.dni },
    antifraud_details: {
      first_name: data.firstName, last_name: data.lastName, phone_number: data.phone,
      address: String(data.address.direccion_linea1 || '').slice(0, 100),
      address_city: String(data.address.distrito || data.address.provincia || 'Lima').slice(0, 30), country_code: 'PE',
    },
  });
  if (result.status < 200 || result.status >= 300 || result.data.object !== 'charge' || !result.data.id) {
    console.error('Culqi rechazó el cargo', result.status, result.text);
    throw new Error(result.data.user_message || result.data.merchant_message || 'Tu banco no aprobó el pago. Prueba con otra tarjeta o medio de pago.');
  }
  return { id: result.data.id, method: token.indexOf('ype_') === 0 ? 'Yape' : 'Tarjeta' };
}

/** Cuando el checkout devuelve la orden, se consulta en Culqi que esté pagada y que sea de este pedido. */
function verifyPaidOrder_(secretKey, culqiOrder, priced, orderId) {
  const result = culqiRequest_('get', CULQI_ORDERS_URL + '/' + encodeURIComponent(culqiOrder), secretKey);
  const order = result.data || {};
  if (result.status < 200 || result.status >= 300 || order.object !== 'order') {
    console.error('No se pudo consultar la orden', result.status, result.text);
    throw new Error('No pudimos verificar el pago. Si se realizó el cobro, escríbenos por WhatsApp.');
  }
  if (String(order.order_number) !== orderId || Number(order.amount) !== priced.amount) {
    throw new Error('El pago no corresponde a este pedido.');
  }
  if (String(order.state).toLowerCase() !== 'paid') {
    console.error('Orden sin pagar', JSON.stringify(order));
    throw new Error('El pago aún no figura como realizado. Si ya pagaste, escríbenos por WhatsApp para confirmarlo.');
  }
  return { id: order.id, method: 'Culqi (orden)' };
}

function registrationResult_(nonce, ok, message, data) {
  const payload = JSON.stringify({ source: 'grinser-sheets', nonce: nonce, ok: ok, message: message, data: data || null });
  const html = '<!doctype html><meta charset="utf-8"><script>window.top.postMessage('
    + payload + ',"*");</script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
