(async ()=>{
  try{
    const API='http://localhost:3000';

    console.log('Requesting OTP...');
    let r=await fetch(API+'/api/auth/request-otp',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({method:'phone', value:'9999999999'})
    });
    let j=await r.json();
    console.log('OTP response:', j);
    const otp=j.otp_demo||j.otp||null;
    if(!otp){ console.error('No OTP returned'); process.exit(2); }

    console.log('Verifying OTP:', otp);
    r=await fetch(API+'/api/auth/verify-otp',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({method:'phone', value:'9999999999', otp})
    });
    j=await r.json();
    if(!j.token){ console.error('Verify failed', j); process.exit(3); }
    const token=j.token;
    console.log('Got token');

    console.log('Fetching products...');
    r=await fetch(API+'/api/products');
    const products=await r.json();
    // pick first trending product
    const first = products.trending && products.trending[0];
    if(!first){ console.error('No products'); process.exit(4); }
    const item={ id:first.id, name:first.name, price:first.price, quantity:1 };
    console.log('Selected item:', item);

    console.log('Syncing cart to server...');
    r=await fetch(API+'/api/cart/sync',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({items:[item]})
    });
    j=await r.json();
    console.log('Cart sync response:', j);

    console.log('Fetching server cart...');
    r=await fetch(API+'/api/cart', { headers:{'Authorization':'Bearer '+token} });
    const cart=await r.json();
    console.log('Cart contents from server:', cart);

    // Verify
    if(Array.isArray(cart) && cart.length>0 && cart[0].id===item.id) console.log('SMOKE TEST PASSED');
    else console.error('SMOKE TEST FAILED');
  }catch(e){ console.error('Error', e); process.exit(1); }
})();