const fc = require('fast-check');

const { subtotal } = require('../../src/subtotal');
const { discounts } = require('../../src/discounts');
const { total } = require('../../src/total');
const { tax } = require('../../src/tax');
const { delivery } = require('../../src/delivery');

// These arbitrary generators provide primitive building blocks for constructing orders and contexts in property-based tests
//
// To learn more about primitives: https://fast-check.dev/docs/core-blocks/arbitraries/primitives
// To learn more about combiners: https://fast-check.dev/docs/core-blocks/arbitraries/combiners
const skuArb = fc.constantFrom('P6-POTATO', 'P12-POTATO', 'P24-POTATO', 'P6-SAUER', 'P12-SAUER');
const addOnArb = fc.constantFrom('sour-cream', 'fried-onion', 'bacon-bits');
const fillingArb = fc.constantFrom('potato', 'sauerkraut', 'sweet-cheese', 'mushroom');
const kindArb = fc.constantFrom('hot', 'frozen');
const tierArb = fc.constantFrom('guest', 'regular', 'vip');
const zoneArb = fc.constantFrom('local', 'outer');

// This composite arbitrary generator builds an order item object using the primitive building blocks defined above
// Each field in the object below specifies the arbitrary generator to use for that field
//
// To learn more about composite arbitraries: https://fast-check.dev/docs/core-blocks/arbitraries/composites
const orderItemArb = fc.record({
  // e.g., this will use the kindArb to generate a value for the 'kind' field
  kind: kindArb,
  sku: skuArb,
  title: fc.string(),
  filling: fillingArb,
  qty: fc.constantFrom(6, 12, 24),
  unitPriceCents: fc.integer({ min: 500, max: 3000 }),
  addOns: fc.array(addOnArb, { maxLength: 3 })
});

// We use the orderItemArb defined above to build an order object that contains an array of order items
const orderArb = fc.record({
  // we specify the maximum and minimum length of the items array here
  items: fc.array(orderItemArb, { minLength: 1, maxLength: 5 })
});

const profileArb = fc.record({
  tier: tierArb
});

const deliveryContextArb = fc.record({
  zone: zoneArb,
  rush: fc.boolean()
});

const couponArb = fc.constantFrom(null, 'PIEROGI-BOGO', 'FIRST10');

// ------------------------------------------------------------------------------
// To test discounts, tax, delivery and total, you will need to add more
// arbitraries to represent the context in which an order is placed.
//
// You will find the following building blocks helpful:
//
// fc.boolean() - to represent true/false flags
// fc.constantFrom(...) - to represent enumerated values
// fc.record({ ... }) - to build composite objects
// fc.optional(...) - to represent optional fields
// ------------------------------------------------------------------------------


describe('Property-Based Tests for Orders', () => {
  describe('Invariants', () => {
    
    // Here's an example preservation property!
    it('subtotal should always be non-negative integer', () => {
      fc.assert(
        fc.property(orderArb, (order) => {
          const result = subtotal(order);
          return result >= 0 && Number.isInteger(result);
        }),
        { numRuns: 50 }
      );
    });

    // ---------------------------------------------------------------------------
    // Add more invariant properties for discounts, tax, delivery, and total here
    // You can adapt the starter code below.
    // Feel free to copy, paste, and modify as needed multiple times.
    // ---------------------------------------------------------------------------
    //
    // it('subtotal should always be non-negative integer', () => {
    //   fc.assert(
    //     fc.property(, (order) => { // add the appropriate arbitraries here
    //       const result = subtotal(order); // change this to the function you are testing
    //       return result >= 0 && Number.isInteger(result); // add the property you want to verify
    //     }),
    //     { numRuns: 50 } // you can adjust the number of runs as needed
    //   );
    // });

    // Difference Testing for Total
    // Verify that adding add-ons to an order always increases the total cost
    it('total without addons should always be lower than total with addons', () => {
      fc.assert(
        fc.property(orderArb, addOnArb, (order, extraAddOn) => {
          // clone the order for two scenarios
          const withAddons = JSON.parse(JSON.stringify(order));
          const withoutAddons = JSON.parse(JSON.stringify(order));

          // ensure at least one addon exists in the "withAddons" case by adding one to the first item
          withAddons.items[0].addOns = (withAddons.items[0].addOns || []).concat(extraAddOn);

          // remove all addons for the "withoutAddons" case
          withoutAddons.items.forEach(item => { item.addOns = []; });

          const totalWith = total(withAddons);
          const totalWithout = total(withoutAddons);

          // total without addons should be strictly less than total with the added addon
          return totalWithout < totalWith;
        }),
        { numRuns: 100 }
      );
    });

    //Verify that applying discounts never increases the total cost
    it('total with discounts should always be less than or equal to total without discounts', () => {
      fc.assert(
        fc.property(orderArb, profileArb, deliveryContextArb, couponArb, (order, profile, deliveryCtx, coupon) => {
          // keep contexts identical except for coupon application
          const ctxWithout = { profile, delivery: deliveryCtx, coupon: null };
          const ctxWith = { profile, delivery: deliveryCtx, coupon };

          // if coupon is null, the two contexts are identical; the property still holds (equality)
          const totalWithout = total(order, ctxWithout);
          const totalWith = total(order, ctxWith);

          // total with discount should be <= total without discount
          return totalWith <= totalWithout;
        }),
        { numRuns: 200 }
      );
    });

    // Verify that rush surcharge always increases total by at least 299 cents
    it('rush surcharge should always increase total by at least 299 cents', () => {
      fc.assert(
        fc.property(orderArb, profileArb, deliveryContextArb, couponArb, (order, profile, deliveryCtx, coupon) => {
          const baseDelivery = Object.assign({}, deliveryCtx, { rush: false });
          const rushDelivery = Object.assign({}, deliveryCtx, { rush: true });

          const ctxNoRush = { profile, delivery: baseDelivery, coupon };
          const ctxRush = { profile, delivery: rushDelivery, coupon };

          const totalNoRush = total(order, ctxNoRush);
          const totalRush = total(order, ctxRush);

          // rush must add at least the 299-cent surcharge
          return totalRush >= totalNoRush + 299;
        }),
        { numRuns: 200 }
      );
    });

  });
});
