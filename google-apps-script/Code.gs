const SHEETS = {
  products: 'Productos',
  categories: 'Categorias',
  clients: 'Clientes',
};
const ADMIN_KEY_PROPERTY = 'GRINSER_ADMIN_KEY';

const PRODUCT_HEADERS = [
  'id', 'nombre', 'categoria', 'marca', 'precio', 'precio_oferta',
  'stock', 'descripcion', 'imagen', 'activo',
];
const CATEGORY_HEADERS = ['id', 'nombre', 'icon'];
const CLIENT_HEADERS = ['id', 'nombre', 'email', 'telefono', 'creado'];

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
  ensureSheet_(spreadsheet, SHEETS.products, PRODUCT_HEADERS, DEFAULT_PRODUCTS);
  ensureSheet_(spreadsheet, SHEETS.categories, CATEGORY_HEADERS, DEFAULT_CATEGORIES);
  ensureSheet_(spreadsheet, SHEETS.clients, CLIENT_HEADERS, []);
  spreadsheet.setSpreadsheetTimeZone('America/Lima');
  console.log('Pestañas Productos, Categorias y Clientes preparadas.');
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
  const json = JSON.stringify({ ok: true, products: catalog.products, categories: catalog.categories });
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
    })).filter((product) => product.id && product.nombre),
    categories: readRows_(spreadsheet, SHEETS.categories, CATEGORY_HEADERS).map((row) => ({
      id: String(row.id || ''),
      nombre: String(row.nombre || ''),
      icon: String(row.icon || 'box'),
    })).filter((category) => category.id && category.nombre),
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
  const cache = CacheService.getScriptCache();
  const cacheKey = 'client-registration-' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email),
  ).replace(/=+$/, '');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const lastRow = sheet.getLastRow();
    const existing = lastRow >= 2
      ? sheet.getRange(2, 1, lastRow - 1, CLIENT_HEADERS.length).getValues()
      : [];
    const matchingIndex = existing.findIndex((row) => String(row[2]).trim().toLowerCase() === email);
    if (matchingIndex >= 0) return registrationResult_(nonce, true, 'Registro procesado.');
    if (cache.get(cacheKey)) throw new Error('Espera unos minutos antes de volver a registrar este correo.');
    const record = [Utilities.getUuid(), name, email, phone, new Date().toISOString()];
    const rowNumber = lastRow + 1;
    sheet.getRange(rowNumber, 1, 1, CLIENT_HEADERS.length).setNumberFormat('@');
    sheet.getRange(rowNumber, 1, 1, CLIENT_HEADERS.length).setValues([record]);
    cache.put(cacheKey, '1', 3600);
  } finally {
    lock.releaseLock();
  }
  return registrationResult_(nonce, true, 'Registro guardado.');
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
    return {
      id: id, nombre: name, categoria: category, marca: brand, precio: price,
      precio_oferta: offer, stock: stock, descripcion: description, imagen: image, activo: product.activo,
    };
  });
  return { categories: categories, products: products };
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
  ]), [1, 2, 3, 4, 8, 9]);
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
  const html = '<!doctype html><meta charset="utf-8"><script>window.parent.postMessage('
    + payload + ',"*");</script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
