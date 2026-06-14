// Load .env configuration
require('dotenv').config();

const db = require('./config/dbService');

async function runTests() {
  console.log('--- STARTING DATABASE ATLAS CONNECTIVITY TESTS ---');
  
  // 1. Initialize DB Connection
  await db.connect();
  console.log(`Database Mode: ${db.useMongoDB ? 'MongoDB' : 'Local JSON DB'}`);

  if (!db.useMongoDB) {
    console.error('ERROR: Connection could not be established to MongoDB Atlas.');
    process.exit(1);
  }

  // 2. Clear old test entries
  await db.deleteMany('users', { username: 'test_admin_dummy' });
  await db.deleteMany('products', { name: 'Test Rod' });
  await db.deleteMany('purchases', { supplierName: 'Test Vendor Co' });
  await db.deleteMany('sales', { customerName: 'Test Client Co' });
  await db.deleteMany('customers', { name: 'Test Client Co' });
  await db.deleteMany('suppliers', { name: 'Test Vendor Co' });

  // 3. Test Authentication insertion
  console.log('\nTesting User Creation on Atlas...');
  const user = await db.insertOne('users', {
    username: 'test_admin_dummy',
    name: 'Test Admin',
    role: 'admin'
  });
  console.log('Created User:', user);
  if (!user._id) throw new Error('User insertion failed: missing _id');

  // 4. Test Product catalog insertion
  console.log('\nTesting Product Creation on Atlas...');
  const product = await db.insertOne('products', {
    name: 'Test Rod',
    category: 'Steel',
    openingStock: 10,
    purchasedQty: 0,
    soldQty: 0,
    currentStock: 10,
    unit: 'Pcs',
    rate: 200,
    minStockLevel: 5
  });
  console.log('Created Product:', product);

  // 5. Test Supplier creation & Procurement flow
  console.log('\nTesting Purchase Log & Ledger Sync on Atlas...');
  const purchase = await db.insertOne('purchases', {
    purchaseDate: '2026-06-14',
    supplierName: 'Test Vendor Co',
    materialName: 'Test Rod',
    quantity: 15,
    unit: 'Pcs',
    rate: 180,
    gstPercent: 18,
    transportCharges: 50,
    totalAmount: 3236, // (15 * 180) * 1.18 + 50 = 3236
    paymentStatus: 'Unpaid'
  });
  
  const { updateInventoryForPurchase, updateSupplierLedger } = require('./utils/ledgerHelper');
  await updateInventoryForPurchase('Test Rod', 'Steel', 15, 'Pcs', 180);
  await updateSupplierLedger('Test Vendor Co', '9816055444', '', '02AAAPV1234', 3236, 'Unpaid');

  const updatedProd = await db.findOne('products', { name: 'Test Rod' });
  const supplier = await db.findOne('suppliers', { name: 'Test Vendor Co' });
  console.log('Updated Product Stock (Expected Current: 25):', updatedProd.currentStock);
  console.log('Supplier Ledger Balance (Expected Outstanding: 3236):', supplier.outstandingPayments);

  if (updatedProd.currentStock !== 25) throw new Error('Inventory adjustment mismatch on purchase!');
  if (supplier.outstandingPayments !== 3236) throw new Error('Supplier ledger outstanding mismatch!');

  // 6. Test Sales Invoicing & Customer Debit flow
  console.log('\nTesting Sales Invoice Log & Customer Debit Sync on Atlas...');
  const sale = await db.insertOne('sales', {
    invoiceNumber: 'JMCF-INV-TEST-01',
    saleDate: '2026-06-14',
    customerName: 'Test Client Co',
    productName: 'Test Rod',
    quantity: 8,
    rate: 250,
    discount: 100,
    gstPercent: 18,
    totalAmount: 2242, // (8 * 250 - 100) * 1.18 = 2242
    paymentMethod: 'Credit'
  });

  const { updateInventoryForSale, updateCustomerLedger } = require('./utils/ledgerHelper');
  await updateInventoryForSale('Test Rod', 8);
  await updateCustomerLedger('Test Client Co', '9876543210', 'Kangra', '02AAAPC5678', 2242, 'Credit');

  const finalProd = await db.findOne('products', { name: 'Test Rod' });
  const customer = await db.findOne('customers', { name: 'Test Client Co' });
  console.log('Final Product Stock (Expected Current: 17):', finalProd.currentStock);
  console.log('Customer Ledger Balance (Expected Outstanding: 2242):', customer.outstandingBalance);

  if (finalProd.currentStock !== 17) throw new Error('Inventory adjustment mismatch on sale!');
  if (customer.outstandingBalance !== 2242) throw new Error('Customer ledger outstanding mismatch!');

  // 7. Cleanup test entries
  console.log('\nCleaning up test collections on Atlas...');
  await db.deleteMany('users', { username: 'test_admin_dummy' });
  await db.deleteMany('products', { name: 'Test Rod' });
  await db.deleteMany('purchases', { supplierName: 'Test Vendor Co' });
  await db.deleteMany('sales', { customerName: 'Test Client Co' });
  await db.deleteMany('customers', { name: 'Test Client Co' });
  await db.deleteMany('suppliers', { name: 'Test Vendor Co' });

  console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY ON ATLAS CLUSTER ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n!!! TEST FLOW FAILURE ON ATLAS !!!\n', err);
  process.exit(1);
});
