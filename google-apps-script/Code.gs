const SHEETS = {
  products: 'Productos',
  categories: 'Categorias',
  clients: 'Clientes',
  events: 'Eventos',
};
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
  ['toner', 'Tóner y tintas', 'drop'],
  ['repuestos', 'Repuestos', 'wrench'],
  ['plotter', 'Plotter', 'printer'],
  ['papeleria', 'Papel y accesorios', 'file'],
];

const DEFAULT_PRODUCTS = [
  ['p-001', 'Impresora multifuncional EcoTank L3250', 'impresoras', 'Epson', 899, 829, 12, 'Imprime, copia y escanea. Sistema de tinta continua y Wi-Fi.', '', true],
  ['p-002', 'Impresora láser LaserJet M111w', 'impresoras', 'HP', 649, '', 8, 'Láser monocromática compacta, hasta 20 ppm, conexión Wi-Fi.', '', true],
  ['p-003', 'Impresora multifuncional DCP-T720DW', 'impresoras', 'Brother', 1199, '', 5, 'Tanque de tinta, dúplex automático y alimentador de documentos.', '', true],
  ['p-004', 'Fotocopiadora multifuncional IM 2702', 'fotocopiadoras', 'Ricoh', 4850, 4590, 3, 'Monocromática A3, 27 ppm, red y escáner a color.', '', true],
  ['p-005', 'Fotocopiadora bizhub C250i', 'fotocopiadoras', 'Konica Minolta', 12900, '', 2, 'Color A3, 25 ppm, panel táctil y seguridad empresarial.', '', true],
  ['p-006', 'Fotocopiadora TASKalfa 2554ci', 'fotocopiadoras', 'Kyocera', 10450, '', 0, 'Color A3, 25 ppm, bajo costo por página.', '', true],
  ['p-007', 'Botella de tinta 544 negra', 'toner', 'Epson', 45, 39, 60, 'Tinta original de 65 ml, rinde hasta 4 500 páginas.', '', true],
  ['p-008', 'Tóner 105A negro', 'toner', 'HP', 229, '', 25, 'Tóner original, rendimiento de 1 000 páginas.', '', true],
  ['p-009', 'Tóner TK-1175', 'toner', 'Kyocera', 189, '', 18, 'Compatible con ECOSYS M2040dn / M2540dn / M2640idw.', '', true],
  ['p-010', 'Unidad de imagen (drum) DR-2340', 'repuestos', 'Brother', 349, 315, 7, 'Tambor original, hasta 12 000 páginas.', '', true],
  ['p-011', 'Kit de fusor para MP 2554', 'repuestos', 'Ricoh', 780, '', 4, 'Repuesto original. Incluye instalación con nuestro servicio técnico.', '', true],
  ['p-012', 'Papel bond A4 75 g (paquete x 500)', 'papeleria', 'Chamex', 21.9, 19.5, 150, 'Blancura alta, ideal para impresión láser y fotocopiado.', '', true],
];

function setupGrinserSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Vincula este proyecto a una hoja de cálculo antes de ejecutar la configuración.');
  ensureSheet_(spreadsheet, SHEETS.products, PRODUCT_HEADERS, DEFAULT_PRODUCTS.map((row) => row.concat(['', '[]', '[]', ''])));
  ensureSheet_(spreadsheet, SHEETS.categories, CATEGORY_HEADERS, DEFAULT_CATEGORIES);
  ensureSheet_(spreadsheet, SHEETS.clients, CLIENT_HEADERS, []);
  ensureSheet_(spreadsheet, SHEETS.events, EVENT_HEADERS, DEFAULT_EVENT_ROWS);
  spreadsheet.setSpreadsheetTimeZone('America/Lima');
  console.log('Pestañas Productos, Categorias, Clientes y Eventos preparadas.');
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

function registrationResult_(nonce, ok, message) {
  const payload = JSON.stringify({ source: 'grinser-sheets', nonce: nonce, ok: ok, message: message });
  const html = '<!doctype html><meta charset="utf-8"><script>window.top.postMessage('
    + payload + ',"*");</script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
