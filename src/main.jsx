import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Search, ShoppingBag, Heart, Bell, UserRound, Menu, X, ChevronDown,
  ArrowRight, Plus, Minus, SlidersHorizontal, MapPin, Star, ShieldCheck,
  BookOpen, Laptop, Shirt, Armchair, Pencil, Sparkles, Package, LayoutDashboard,
  MessageCircle, LogOut, CheckCircle2, CircleUserRound, Store, Megaphone,
  Trash2, Camera, ArrowUpRight, Clock3, ShoppingCart, BadgeCheck, SearchX
} from 'lucide-react'
import { mapProduct, mapUser, supabase, supabaseConfigError, unwrap } from './supabase'
import './styles.css'

const categories = [
  { name: 'All items', icon: Package, tint: 'mint' },
  { name: 'Textbooks', icon: BookOpen, tint: 'peach' },
  { name: 'Electronics', icon: Laptop, tint: 'lavender' },
  { name: 'Clothing', icon: Shirt, tint: 'pink' },
  { name: 'Accessories', icon: Sparkles, tint: 'yellow' },
  { name: 'Furniture', icon: Armchair, tint: 'blue' },
  { name: 'Food & Groceries', icon: Package, tint: 'green' },
  { name: 'Stationery', icon: Pencil, tint: 'green' },
  { name: 'Services', icon: MessageCircle, tint: 'peach' }
]
const money = n => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n)
function App() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [posts, setPosts] = useState([])
  const [user, setUser] = useState(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All items')
  const [sort, setSort] = useState('recommended')
  const [maxPrice, setMaxPrice] = useState(2000)
  const [condition, setCondition] = useState('Any condition')
  const [page, setPage] = useState('Home')
  const [selected, setSelected] = useState(null)
  const [drawer, setDrawer] = useState('')
  const [toast, setToast] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authOpen, setAuthOpen] = useState(false)
  const [sellOpen, setSellOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const orderHistory = orders

  useEffect(() => {
    if (!supabase) {
      setToast(supabaseConfigError)
      return undefined
    }
    let active = true
    const loadProductsAndPosts = async () => {
      try {
        const [productData, postData] = await Promise.all([
          supabase.from('products').select('*').order('created_at', { ascending: false }),
          supabase.from('community_posts').select('*').order('created_at', { ascending: false })
        ])
        if (!active) return
        setProducts(unwrap(productData).map(mapProduct))
        setPosts(unwrap(postData).map(post => ({ ...post, date: post.created_at ? new Date(post.created_at).toLocaleDateString('en-ZA') : 'Today' })))
      } catch (error) {
        if (active) setToast(error.message)
      }
    }
    const load = async () => {
      try {
        await loadProductsAndPosts()
        if (!active) return
        const session = unwrap(await supabase.auth.getSession()).session
        if (session?.user) await loadAccountData(session.user)
      } catch (error) {
        if (!active) return
        setToast(error.message)
      }
    }
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user ? mapUser(session.user) : null)
      if (session?.user) Promise.resolve().then(() => loadAccountData(session.user)).catch(error => setToast(error.message))
      else {
        setCart([])
        setWishlist([])
        setOrders([])
      }
      loadProductsAndPosts()
    })
    return () => { active = false }
  }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t) }, [toast])

  const filtered = useMemo(() => {
    let list = products.filter(p => p.status !== 'sold')
    if (category !== 'All items') list = list.filter(p => p.category === category)
    if (query.trim()) list = list.filter(p => `${p.title} ${p.category} ${p.seller} ${p.description}`.toLowerCase().includes(query.toLowerCase()))
    list = list.filter(p => Number(p.price) <= maxPrice)
    if (condition !== 'Any condition') list = list.filter(p => p.condition === condition)
    if (sort === 'price-low') list.sort((a,b) => a.price - b.price)
    if (sort === 'price-high') list.sort((a,b) => b.price - a.price)
    if (sort === 'newest') list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    return list
  }, [products, category, query, maxPrice, condition, sort])
  const cartCount = cart.reduce((n, item) => n + item.qty, 0)
  const cartTotal = cart.reduce((n, item) => n + item.price * item.qty, 0)
  const navigate = (p) => { setPage(p); setDrawer(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const loadAccountData = async authUser => {
    const [savedResult, cartResult, ordersResult] = await Promise.all([
      supabase.from('wishlist_items').select('product_id').eq('user_id', authUser.id),
      supabase.from('cart_items').select('quantity, product:products(*)').eq('user_id', authUser.id),
      supabase.from('orders').select('*').eq('buyer_id', authUser.id).order('created_at', { ascending: false })
    ])
    setWishlist(unwrap(savedResult).map(item => item.product_id))
    setCart(unwrap(cartResult).filter(item => item.product).map(item => ({ ...mapProduct(item.product), qty: item.quantity })))
    setOrders(unwrap(ordersResult).map(order => ({
      ...order,
      id: `CS-${order.id.slice(0, 8).toUpperCase()}`,
      date: new Date(order.created_at).toLocaleDateString('en-ZA'),
      buyer: authUser.email,
      items: order.items || []
    })))
  }
  const addCart = async p => {
    if (!supabase) { setToast(supabaseConfigError); return }
    if (!user) { setAuthMode('login'); setAuthOpen(true); setToast('Sign in to add items to your bag.'); return }
    try {
      const item = cart.find(i => i.id === p.id)
      const result = await supabase.from('cart_items').upsert(
        { user_id: user.id, product_id: p.id, quantity: Math.min((item?.qty || 0) + 1, 10) },
        { onConflict: 'user_id,product_id' }
      )
      unwrap(result)
      const cartResult = await supabase.from('cart_items').select('quantity, product:products(*)').eq('user_id', user.id)
      setCart(unwrap(cartResult).filter(row => row.product).map(row => ({ ...mapProduct(row.product), qty: row.quantity })))
      setToast('Added to your bag')
      setSelected(null)
    } catch (error) { setToast(error.message) }
  }
  const changeQty = async (id, delta) => {
    const item = cart.find(i => i.id === id)
    if (!item) return
    const quantity = item.qty + delta
    try {
      if (quantity < 1) {
        unwrap(await supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', id))
        setCart(old => old.filter(i => i.id !== id))
      } else {
        unwrap(await supabase.from('cart_items').update({ quantity }).eq('user_id', user.id).eq('product_id', id))
        setCart(old => old.map(i => i.id === id ? { ...i, qty: quantity } : i))
      }
    } catch (error) { setToast(error.message) }
  }
  const removeCartItem = async id => {
    try {
      unwrap(await supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', id))
      setCart(old => old.filter(item => item.id !== id))
    } catch (error) { setToast(error.message) }
  }
  const toggleWish = async id => {
    if (!user) { setAuthMode('login'); setAuthOpen(true); setToast('Sign in to save items to your wishlist.'); return }
    const saved = wishlist.includes(id)
    try {
      if (saved) {
        unwrap(await supabase.from('wishlist_items').delete().eq('user_id', user.id).eq('product_id', id))
      } else {
        unwrap(await supabase.from('wishlist_items').insert({ user_id: user.id, product_id: id }))
      }
      setWishlist(old => saved ? old.filter(value => value !== id) : [...old, id])
      setToast(saved ? 'Removed from saved items' : 'Saved to your wishlist')
    } catch (error) { setToast(error.message) }
  }
  const signIn = async e => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    try {
      if (!supabase) throw new Error(supabaseConfigError)
      const email = data.get('email')?.toString().trim()
      const password = data.get('password')?.toString()
      const result = authMode === 'register'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { name: data.get('name')?.toString().trim(), role: data.get('role')?.toString() } }
          })
        : await supabase.auth.signInWithPassword({ email, password })
      const authData = unwrap(result)
      const authUser = authData.user
      if (!authUser) throw new Error('Authentication did not return an account.')
      if (!authData.session) {
        setAuthOpen(false)
        setToast('Account created. Check your email to confirm it, then sign in.')
        return
      }
      setUser(mapUser(authUser))
      setAuthOpen(false)
      await loadAccountData(authUser)
      setToast(`Welcome, ${mapUser(authUser).name}!`)
    } catch (error) { setToast(error.message) }
  }
  const createListing = async e => {
    e.preventDefault()
    const d = new FormData(e.currentTarget)
    let uploadedImagePath
    try {
      if (!supabase || !user) throw new Error('Sign in to publish a listing.')
      const image = d.get('image')
      if (!(image instanceof File) || !image.size) throw new Error('Choose an item photo to upload.')
      const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
      const extension = extensions[image.type]
      if (!extension) throw new Error('Upload a JPG, PNG, WEBP, or GIF image.')
      if (image.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.')
      const imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`
      const upload = unwrap(await supabase.storage.from('product-images').upload(imagePath, image, {
        upsert: false,
        contentType: image.type
      }))
      uploadedImagePath = upload.path
      const imageUrl = supabase.storage.from('product-images').getPublicUrl(upload.path).data.publicUrl
      const { data: product, error } = await supabase.from('products').insert({
        title: d.get('title')?.toString().trim(),
        category: d.get('category')?.toString(),
        price: Number(d.get('price')),
        condition: d.get('condition')?.toString(),
        location: d.get('location')?.toString().trim() || 'Cape Town',
        seller: user.name,
        initials: user.initials,
        image: imageUrl,
        badge: 'Just listed',
        description: d.get('description')?.toString().trim(),
        owner_id: user.id
      }).select('*').single()
      if (error) {
        throw error
      }
      uploadedImagePath = null
      setProducts(old => [mapProduct(product), ...old])
      setSellOpen(false); setCategory('All items'); setQuery(''); setPage('Marketplace'); setToast('Your item has been listed')
    } catch (error) {
      if (uploadedImagePath) {
        const cleanup = await supabase.storage.from('product-images').remove([uploadedImagePath])
        if (cleanup.error) console.error('Could not remove an unlisted uploaded image.', cleanup.error)
      }
      setToast(error.message)
    }
  }
  const checkout = async e => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    try {
      if (!supabase || !user) throw new Error('Sign in to place an order.')
      const orderItems = cart.map(({ id, title, price, qty }) => ({ product_id: id, title, price, quantity: qty }))
      const { data: order, error } = await supabase.from('orders').insert({
        buyer_id: user.id,
        total: cartTotal,
        status: 'Awaiting collection',
        collection_option: data.get('delivery')?.toString(),
        note: data.get('note')?.toString() || '',
        items: orderItems
      }).select('*').single()
      if (error) throw error
      const clearCartResult = await supabase.from('cart_items').delete().eq('user_id', user.id)
      setOrders(old => [{
        ...order,
        id: `CS-${order.id.slice(0, 8).toUpperCase()}`,
        date: new Date(order.created_at).toLocaleDateString('en-ZA'),
        buyer: user.email,
        items: orderItems
      }, ...old])
      setCart([])
      setCheckoutOpen(false)
      if (clearCartResult.error) {
        setToast(`Your order was placed, but your bag could not be cleared: ${clearCartResult.error.message}`)
      } else {
        setToast('Your order has been placed. Contact the seller to arrange collection.')
      }
      navigate('My orders')
    } catch (error) { setToast(error.message) }
  }
  const createPost = async e => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    try {
      if (!supabase || !user) throw new Error('Sign in to publish a community post.')
      const { data: post, error } = await supabase.from('community_posts').insert({
        title: data.get('title')?.toString().trim(),
        category: data.get('category')?.toString(),
        body: data.get('body')?.toString().trim(),
        author: user.name,
        owner_id: user.id
      }).select('*').single()
      if (error) throw error
      setPosts(old => [{ ...post, date: 'Just now' }, ...old])
      setDrawer('')
      setToast('Your community post has been added')
    } catch (error) { setToast(error.message) }
  }
  const updateProductStatus = async (product, status) => {
    try {
      unwrap(await supabase.from('products').update({ status }).eq('id', product.id).eq('owner_id', user.id))
      setProducts(old => old.map(item => item.id === product.id ? { ...item, status } : item))
      setToast('Listing updated')
    } catch (error) { setToast(error.message) }
  }
  const deleteProduct = async id => {
    try {
      const product = products.find(item => item.id === id)
      unwrap(await supabase.from('products').delete().eq('id', id).eq('owner_id', user.id))
      if (product?.image) {
        const imagePath = product.image.split('/product-images/').pop()
        if (imagePath) {
          const cleanup = await supabase.storage.from('product-images').remove([decodeURIComponent(imagePath)])
          if (cleanup.error) console.error('Could not remove the deleted listing image.', cleanup.error)
        }
      }
      setProducts(old => old.filter(item => item.id !== id))
    } catch (error) { setToast(error.message) }
  }
  const doLogout = () => {
    supabase?.auth.signOut().then(({ error }) => {
      if (error) {
        setToast(error.message)
        return
      }
      setToast('You have signed out')
    }).catch(error => setToast(error.message))
    setUser(null); setCart([]); setWishlist([]); setOrders([]); setDrawer('')
  }

  return <div className="app-shell">
    <div className="top-strip"><span><ShieldCheck size={14}/> A marketplace built around community trust</span><span className="top-right">Buy thoughtfully. Sell locally. Waste less.</span></div>
    <header className="header">
      <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setDrawer('menu')}><Menu/></button>
      <button className="brand" onClick={() => navigate('Home')} aria-label="Community Store home"><span className="brand-mark"><img src="/photos/LOGO.png" alt="Community Store logo"/></span><span className="brand-copy">community<span>store</span><small>GOOD FINDS. GOOD PEOPLE.</small></span></button>
      <nav className="main-nav">
        <button className={page==='Home'?'active':''} onClick={()=>navigate('Home')}>Home</button>
        <button className={page==='Marketplace'?'active':''} onClick={()=>navigate('Marketplace')}>Marketplace</button>
        <button className={page==='Community'?'active':''} onClick={()=>navigate('Community')}>Community</button>
      </nav>
      <div className="header-actions">
        <button className="icon-button notification-btn" aria-label="Notifications" onClick={()=>{setDrawer('notifications')}}><Bell size={20}/><i/></button>
        <button className="icon-button" aria-label="Saved items" onClick={()=>navigate('Saved items')}><Heart size={20}/>{wishlist.length>0&&<b className="count-dot">{wishlist.length}</b>}</button>
        <button className="icon-button bag-button" aria-label="Shopping bag" onClick={()=>setDrawer('cart')}><ShoppingBag size={20}/>{cartCount>0&&<b className="count-dot">{cartCount}</b>}</button>
        {user ? <button className="profile-trigger" onClick={()=>setDrawer('profile')}><span className="avatar">{user.initials}</span><span className="profile-name">{user.name.split(' ')[0]}</span><ChevronDown size={15}/></button> : <button className="button button-outline sign-in" onClick={()=>{setAuthMode('login');setAuthOpen(true)}}>Sign in</button>}
      </div>
    </header>

    {page==='Home' && <main className="storefront">
      <section className="storefront-hero wrap">
        <div className="storefront-promo">
          <div className="storefront-copy">
            <span className="storefront-kicker">GOOD FINDS. GOOD PEOPLE.</span>
            <h1>Big finds.<br/>Closer to home.</h1>
            <p>Shop great-value favourites from people and local sellers in your community.</p>
            <div className="hero-search storefront-search"><Search size={20}/><input aria-label="Search marketplace" placeholder="What are you looking for today?" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&navigate('Marketplace')}/><button onClick={()=>navigate('Marketplace')}>Search <ArrowRight size={16}/></button></div>
            <button className="storefront-shop" onClick={()=>{setCategory('All items');navigate('Marketplace')}}>Shop all deals <ArrowRight size={16}/></button>
          </div>
          <div className="storefront-products" aria-label="Popular community finds">
            <div className="storefront-product storefront-product-main"><img src="/photos/headset.jpg" alt="Wireless headphones"/></div>
            <div className="storefront-product storefront-product-top"><img src="/photos/bag.jpg" alt="Canvas tote bag"/></div>
            <div className="storefront-product storefront-product-bottom"><img src="/photos/watch.jpg" alt="Classic wristwatch"/></div>
            <span className="storefront-deal-tag">Good finds, great prices</span>
          </div>
        </div>
      </section>

      <section className="storefront-perks wrap"><div><ShieldCheck/><span><b>Shop with confidence</b><small>Community-first local finds</small></span></div><div><MapPin/><span><b>Buy close to home</b><small>Find sellers in your area</small></span></div><div><Heart/><span><b>Give good things a second life</b><small>Reuse more, waste less</small></span></div></section>

      <section className="wrap storefront-categories">
        <div className="storefront-heading"><div><span className="storefront-kicker">BROWSE THE AISLES</span><h2>Shop by category</h2></div><button className="text-link" onClick={()=>{setCategory('All items');navigate('Marketplace')}}>View all <ArrowRight size={16}/></button></div>
        <div className="category-grid">{categories.filter(c=>c.name!=='All items').map(c=><button className="category-card" key={c.name} onClick={()=>{setCategory(c.name);navigate('Marketplace')}}><span className={`category-icon ${c.tint}`}><c.icon size={23}/></span><span>{c.name}</span><ArrowUpRight size={15} className="category-arrow"/></button>)}</div>
      </section>

      <section className="storefront-deals">
        <div className="wrap">
          <div className="storefront-heading"><div><span className="storefront-kicker">PICKS FROM YOUR COMMUNITY</span><h2>Popular right now</h2><p>Handy finds at prices worth a closer look.</p></div><button className="text-link" onClick={()=>{setCategory('All items');navigate('Marketplace')}}>Shop all items <ArrowRight size={16}/></button></div>
          <div className="product-grid">{products.filter(p=>p.status!=='sold'&&p.category!=='Textbooks').slice(0,4).map(p=><ProductCard key={p.id} product={p} wished={wishlist.includes(p.id)} onOpen={()=>setSelected(p)} onWish={()=>toggleWish(p.id)} onAdd={()=>addCart(p)}/>)}</div>
        </div>
      </section>

      <section className="community-banner wrap"><div className="community-banner-icon"><Megaphone size={25}/></div><div><div className="eyebrow">MORE THAN A MARKETPLACE</div><h2>Good things happen when we share.</h2><p>Discover campus events, helpful services and updates from the people around you.</p></div><button className="button button-primary" onClick={()=>navigate('Community')}>Explore the community <ArrowRight size={17}/></button></section>
      <section className="wrap value-row"><div><ShieldCheck/><b>Community-minded</b><span>Built around respectful local exchange.</span></div><div><Heart/><b>Better for your budget</b><span>Find what you need for less.</span></div><div><Sparkles/><b>Give things a second life</b><span>Make reuse part of everyday life.</span></div></section>
    </main>}

    {page==='Marketplace' && <main className="wrap page-main">
      <div className="page-title-row"><div><div className="eyebrow">THE COMMUNITY MARKET</div><h1>Find your next good thing.</h1><p>Browse pre-loved finds and local favourites.</p></div><button className="button button-primary" onClick={()=>user?setSellOpen(true):setAuthOpen(true)}><Plus size={17}/> Sell an item</button></div>
      <div className="market-search"><Search size={19}/><input placeholder="Search products, categories or sellers..." value={query} onChange={e=>setQuery(e.target.value)}/><button className={`filter-toggle ${showFilters?'selected':''}`} onClick={()=>setShowFilters(!showFilters)}><SlidersHorizontal size={17}/> Filters</button></div>
      <div className="market-layout">{showFilters&&<aside className="filter-panel"><div className="filter-head"><b>Filters</b><button onClick={()=>{setMaxPrice(2000);setCondition('Any condition');setCategory('All items')}}>Reset</button></div><label>Category</label>{categories.map(c=><button className={`filter-category ${category===c.name?'chosen':''}`} key={c.name} onClick={()=>setCategory(c.name)}>{c.name}<span>{c.name==='All items'?products.length:products.filter(p=>p.category===c.name).length}</span></button>)}<label className="filter-label">Maximum price <strong>{money(maxPrice)}</strong></label><input className="range-input" type="range" min="50" max="2000" step="50" value={maxPrice} onChange={e=>setMaxPrice(Number(e.target.value))}/><label className="filter-label">Condition</label><select value={condition} onChange={e=>setCondition(e.target.value)}><option>Any condition</option><option>New</option><option>Like new</option><option>Good</option><option>Fair</option></select></aside>}
        <div className="market-results"><div className="results-toolbar"><span><b>{filtered.length}</b> items to explore</span><label>Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">Recommended</option><option value="newest">Recently added</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>{filtered.length?<div className="product-grid">{filtered.map(p=><ProductCard key={p.id} product={p} wished={wishlist.includes(p.id)} onOpen={()=>setSelected(p)} onWish={()=>toggleWish(p.id)} onAdd={()=>addCart(p)}/>)}</div>:<div className="empty-state"><SearchX size={36}/><h3>No items found just yet</h3><p>Try another search or reset your filters to discover more.</p><button className="button button-outline" onClick={()=>{setQuery('');setCategory('All items');setMaxPrice(2000);setCondition('Any condition')}}>Clear filters</button></div>}</div>
      </div>
    </main>}

    {page==='Saved items' && <main className="wrap page-main"><div className="page-title-row"><div><div className="eyebrow">YOUR LITTLE SHORTLIST</div><h1>Saved items</h1><p>Keep the good finds close while you decide.</p></div><button className="button button-outline" onClick={()=>navigate('Marketplace')}>Explore marketplace</button></div>{products.filter(p=>wishlist.includes(p.id)).length?<div className="product-grid">{products.filter(p=>wishlist.includes(p.id)).map(p=><ProductCard key={p.id} product={p} wished onOpen={()=>setSelected(p)} onWish={()=>toggleWish(p.id)} onAdd={()=>addCart(p)}/>)}</div>:<div className="empty-state"><Heart size={36}/><h3>Your saved list is waiting</h3><p>Tap the heart on an item to keep it here.</p><button className="button button-primary" onClick={()=>navigate('Marketplace')}>Find something lovely</button></div>}</main>}

    {page==='Community' && <main className="wrap page-main"><div className="page-title-row"><div><div className="eyebrow">A PLACE FOR THE PEOPLE</div><h1>Community board.</h1><p>Local updates, campus happenings and services worth sharing.</p></div><button className="button button-primary" onClick={()=>user?setDrawer('post'):setAuthOpen(true)}><Plus size={17}/> Create a post</button></div><div className="community-intro"><div><Megaphone size={24}/><span><b>Make yourself at home.</b><small>Keep posts kind, useful and relevant to our community.</small></span></div><span className="community-pill">Community guidelines apply</span></div><div className="post-grid">{posts.map(post=><article className="post-card" key={post.id}><div className="post-card-top"><span className="post-icon"><Megaphone size={19}/></span><span className="post-category">{post.category}</span></div><h3>{post.title}</h3><p>{post.body}</p><div className="post-meta"><span className="avatar avatar-small">{post.author.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span><span><b>{post.author}</b><small>{post.date}</small></span></div></article>)}</div></main>}

    {page==='Seller dashboard' && <main className="wrap page-main"><div className="page-title-row"><div><div className="eyebrow">YOUR SELLER SPACE</div><h1>Seller dashboard.</h1><p>Keep track of the things you are passing on.</p></div><button className="button button-primary" onClick={()=>setSellOpen(true)}><Plus size={17}/> Add a listing</button></div><div className="stat-grid"><Stat label="Active listings" value={products.filter(p=>p.ownerId===user?.id&&p.status!=='sold').length} icon={Package}/><Stat label="Items listed" value={products.filter(p=>p.ownerId===user?.id).length} icon={Store}/><Stat label="Orders placed" value={orders.length} icon={ShoppingCart}/><Stat label="Saved items" value={wishlist.length} icon={Heart}/></div><div className="dashboard-panel"><div className="panel-heading"><h3>Your listings</h3><span>Manage your marketplace items</span></div>{products.filter(p=>p.ownerId===user?.id).length?products.filter(p=>p.ownerId===user?.id).map(p=><div className="listing-row" key={p.id}><img src={p.image} alt=""/><div><b>{p.title}</b><small>{p.category} · {p.condition}</small></div><strong>{money(p.price)}</strong><span className={`status ${p.status==='sold'?'sold':''}`}>{p.status==='sold'?'Sold':'Active'}</span><button className="icon-button" title={p.status==='sold'?'Mark as active':'Mark as sold'} onClick={()=>updateProductStatus(p,p.status==='sold'?'active':'sold')}><CheckCircle2 size={18}/></button><button className="icon-button" title="Delete listing" onClick={()=>deleteProduct(p.id)}><Trash2 size={17}/></button></div>):<div className="empty-inline"><Package size={25}/><span><b>No listings yet</b><small>Your items will appear here once you list them.</small></span><button className="button button-outline" onClick={()=>setSellOpen(true)}>List your first item</button></div>}</div></main>}

    {page==='Admin dashboard' && <main className="wrap page-main"><div className="page-title-row"><div><div className="eyebrow">PLATFORM OVERVIEW</div><h1>Admin dashboard.</h1><p>A quick look at activity across the marketplace.</p></div><span className="demo-label"><ShieldCheck size={15}/> Administrator view</span></div><div className="stat-grid"><Stat label="Your account" value={user?1:0} icon={CircleUserRound}/><Stat label="Active listings" value={products.filter(p=>p.status!=='sold').length} icon={Package}/><Stat label="Your orders" value={orders.length} icon={ShoppingCart}/><Stat label="Community posts" value={posts.length} icon={Megaphone}/></div><div className="admin-columns"><div className="dashboard-panel"><div className="panel-heading"><h3>Recent listings</h3><span>Latest activity</span></div>{products.slice(0,5).map(p=><div className="listing-row" key={p.id}><img src={p.image} alt=""/><div><b>{p.title}</b><small>{p.seller} · {p.category}</small></div><strong>{money(p.price)}</strong><span className="status">Active</span></div>)}</div><div className="dashboard-panel"><div className="panel-heading"><h3>Platform services</h3></div><div className="health-item"><CheckCircle2/><span><b>Product browsing</b><small>Connected to the marketplace API</small></span><span className="health-status">Ready</span></div><div className="health-item"><CheckCircle2/><span><b>PostgreSQL database</b><small>Listings, accounts and orders are persisted</small></span><span className="health-status">Ready</span></div><div className="health-item warning"><Clock3/><span><b>Online payments</b><small>Payments are arranged with sellers separately</small></span><span className="pending-status">Not connected</span></div></div></div></main>}

    {page==='My orders' && <main className="wrap page-main"><div className="page-title-row"><div><div className="eyebrow">YOUR PURCHASES</div><h1>My orders.</h1><p>Your purchases, saved to your account.</p></div><button className="button button-outline" onClick={()=>navigate('Marketplace')}>Continue shopping</button></div>{orderHistory.filter(o=>!user||o.buyer===user.email).length?<div className="dashboard-panel">{orderHistory.filter(o=>!user||o.buyer===user.email).map(o=><div className="order-row" key={o.id}><div className="order-icon"><ShoppingBag/></div><div><b>Order {o.id}</b><small>Placed {o.date} · {o.items.length} item(s)</small><span className="status pending">{o.status}</span></div><strong>{money(o.total)}</strong><button className="text-link" onClick={()=>setToast('Contact the seller to arrange collection and payment.')}>View details <ArrowRight size={15}/></button></div>)}</div>:<div className="empty-state"><ShoppingBag size={36}/><h3>No orders yet</h3><p>Your purchases will appear here after checkout.</p><button className="button button-primary" onClick={()=>navigate('Marketplace')}>Explore marketplace</button></div>}</main>}

    <footer className="footer"><div className="wrap footer-main"><div className="footer-brand"><button className="brand brand-light" onClick={()=>navigate('Home')}><span className="brand-mark"><img src="/photos/LOGO.png" alt="Community Store logo"/></span><span className="brand-copy">community<span>store</span><small>GOOD FINDS. GOOD PEOPLE.</small></span></button><p>A little more community in every exchange.</p></div><div className="footer-links"><div><b>Explore</b><button onClick={()=>navigate('Marketplace')}>Marketplace</button><button onClick={()=>navigate('Community')}>Community board</button><button onClick={()=>navigate('Saved items')}>Saved items</button></div><div><b>Your account</b><button onClick={()=>user?navigate('Seller dashboard'):setAuthOpen(true)}>Seller dashboard</button><button onClick={()=>navigate('My orders')}>My orders</button><button onClick={()=>setToast('Help centre coming soon.')}>Help centre</button></div><div><b>Our promise</b><span>Shop thoughtfully</span><span>Support local sellers</span><span>Give items a second life</span></div></div></div><div className="wrap footer-bottom"><span>© 2026 Community Store</span><span><ShieldCheck size={14}/> Designed for community trust</span></div></footer>

    {drawer==='cart'&&<><div className="scrim" onClick={()=>setDrawer('')}/><aside className="side-drawer"><div className="drawer-head"><div><h3>Your bag <span>({cartCount})</span></h3><small>Good finds, almost yours.</small></div><button className="icon-button" onClick={()=>setDrawer('')}><X/></button></div>{cart.length?<><div className="cart-items">{cart.map(item=><div className="cart-item" key={item.id}><img src={item.image} alt=""/><div className="cart-item-info"><b>{item.title}</b><small>{item.condition}</small><strong>{money(item.price)}</strong><div className="qty-control"><button onClick={()=>changeQty(item.id,-1)} aria-label="Decrease quantity"><Minus size={13}/></button><span>{item.qty}</span><button onClick={()=>changeQty(item.id,1)} aria-label="Increase quantity"><Plus size={13}/></button></div></div><button className="remove-item" onClick={()=>removeCartItem(item.id)} aria-label="Remove item"><Trash2 size={16}/></button></div>)}</div><div className="cart-summary"><div><span>Subtotal</span><b>{money(cartTotal)}</b></div><div><span>Delivery / collection</span><span>Arranged with seller</span></div><p><ShieldCheck size={15}/> Payment is arranged directly with the seller.</p><button className="button button-primary full-button" onClick={()=>{setDrawer('');setCheckoutOpen(true)}}>Continue to checkout <ArrowRight size={17}/></button></div></>:<div className="empty-state drawer-empty"><ShoppingBag size={36}/><h3>Your bag is taking a breather</h3><p>Add a few good finds and they will show up here.</p><button className="button button-primary" onClick={()=>{setDrawer('');navigate('Marketplace')}}>Browse items</button></div>}</aside></>}

    {drawer==='profile'&&<><div className="scrim" onClick={()=>setDrawer('')}/><aside className="side-drawer profile-drawer"><div className="drawer-head"><h3>Your account</h3><button className="icon-button" onClick={()=>setDrawer('')}><X/></button></div><div className="profile-card"><span className="avatar avatar-large">{user?.initials}</span><div><b>{user?.name}</b><small>{user?.email}</small><span className="role-chip">{user?.role}</span></div></div><button className="drawer-link" onClick={()=>navigate('Seller dashboard')}><LayoutDashboard/> Seller dashboard <ArrowRight/></button><button className="drawer-link" onClick={()=>navigate('My orders')}><ShoppingBag/> My orders <ArrowRight/></button><button className="drawer-link" onClick={()=>navigate('Saved items')}><Heart/> Saved items <ArrowRight/></button><button className="drawer-link" onClick={()=>navigate(user?.role==='Administrator'?'Admin dashboard':'Community')}><UserRound/> {user?.role==='Administrator'?'Admin dashboard':'Community board'} <ArrowRight/></button><button className="drawer-link logout-link" onClick={doLogout}><LogOut/> Sign out</button></aside></>}

    {drawer==='notifications'&&<><div className="scrim" onClick={()=>setDrawer('')}/><aside className="side-drawer"><div className="drawer-head"><div><h3>Notifications</h3><small>Little updates from your community.</small></div><button className="icon-button" onClick={()=>setDrawer('')}><X/></button></div><div className="notification-item"><span className="notification-icon"><Megaphone/></span><div><b>Welcome to Community Store</b><p>Explore local finds and meet the people behind them.</p><small>Community update</small></div></div><div className="notification-item"><span className="notification-icon peach"><ShieldCheck/></span><div><b>Shop with care</b><p>Arrange collection in a safe public place and check items before buying.</p><small>Safety reminder</small></div></div></aside></>}

    {drawer==='menu'&&<><div className="scrim" onClick={()=>setDrawer('')}/><aside className="side-drawer"><div className="drawer-head"><h3>Menu</h3><button className="icon-button" onClick={()=>setDrawer('')}><X/></button></div>{['Home','Marketplace','Community','Saved items','My orders'].map(x=><button className="drawer-link" key={x} onClick={()=>navigate(x)}>{x}<ArrowRight/></button>)}{user&&<button className="drawer-link" onClick={()=>navigate('Seller dashboard')}>Seller dashboard <ArrowRight/></button>}</aside></>}

    {drawer==='post'&&<Modal title="Share with the community" onClose={()=>setDrawer('')}><form className="form-stack" onSubmit={createPost}><label>Post title<input required name="title" placeholder="What would you like to share?"/></label><label>Category<select name="category"><option>Community news</option><option>Campus events</option><option>Local services</option><option>Student societies</option><option>Fundraising</option></select></label><label>Details<textarea required name="body" rows="4" placeholder="Add helpful details..."/></label><button className="button button-primary full-button">Publish post <ArrowRight size={16}/></button></form></Modal>}

    {selected&&<Modal title="Item details" onClose={()=>setSelected(null)} wide><div className="product-detail"><div className="detail-image"><img src={selected.image} alt={selected.title}/>{selected.badge&&<span className="product-badge">{selected.badge}</span>}</div><div className="detail-info"><span className="detail-category">{selected.category} · {selected.condition}</span><h2>{selected.title}</h2><div className="detail-price">{money(selected.price)} {selected.oldPrice&&<del>{money(selected.oldPrice)}</del>}</div><div className="seller-line"><span className="avatar">{selected.initials}</span><div><b>{selected.seller}</b><small><Star size={12} fill="currentColor"/> {selected.rating} · {selected.reviews} reviews</small></div><BadgeCheck size={18} className="verified-mark"/></div><p>{selected.description}</p><div className="detail-location"><MapPin size={16}/>{selected.location}</div><div className="detail-safety"><ShieldCheck size={18}/><span><b>A safer community exchange</b><small>Agree on collection details with the seller. Meet in a public place.</small></span></div><div className="detail-actions"><button className="button button-primary" onClick={()=>addCart(selected)}><ShoppingBag size={17}/> Add to bag</button><button className={`button button-outline ${wishlist.includes(selected.id)?'wish-active':''}`} onClick={()=>toggleWish(selected.id)}><Heart size={17} fill={wishlist.includes(selected.id)?'currentColor':'none'}/>{wishlist.includes(selected.id)?'Saved':'Save item'}</button></div></div></div></Modal>}

    {authOpen&&<Modal title={authMode==='register'?'Join the community':'Welcome back'} subtitle={authMode==='register'?'Create an account to buy, sell and connect.':'Sign in to continue your community journey.'} onClose={()=>setAuthOpen(false)}><form className="form-stack" onSubmit={signIn}>{authMode==='register'&&<><label>Your name<input name="name" required maxLength="80" placeholder="e.g. Alex Mokoena"/></label><label>Account type<select name="role" required><option>Student</option><option>Faculty</option><option>Local Vendor</option><option>Resident</option></select></label></>}<label>Email address<input name="email" required type="email" maxLength="254" placeholder="you@example.com"/></label><label>Password<input name="password" required type="password" minLength="8" maxLength="128" autoComplete={authMode==='register'?'new-password':'current-password'} placeholder="At least 8 characters"/></label><button className="button button-primary full-button">{authMode==='register'?'Create account':'Sign in'} <ArrowRight size={16}/></button><div className="auth-switch">{authMode==='register'?'Already part of the community?':'New around here?'} <button type="button" onClick={()=>setAuthMode(authMode==='register'?'login':'register')}>{authMode==='register'?'Sign in':'Create an account'}</button></div></form></Modal>}

    {sellOpen&&<Modal title="List something good" subtitle="Give a useful item a new home in the community." onClose={()=>setSellOpen(false)}><form className="form-stack" onSubmit={createListing}><label>Item name<input required name="title" maxLength="120" placeholder="e.g. First-year accounting textbook"/></label><div className="form-two"><label>Price (R)<input required name="price" type="number" min="1" max="10000000" placeholder="150"/></label><label>Category<select name="category">{categories.filter(c=>c.name!=='All items').map(c=><option key={c.name}>{c.name}</option>)}</select></label></div><div className="form-two"><label>Condition<select name="condition"><option>Like new</option><option>New</option><option>Good</option><option>Fair</option></select></label><label>Location<input name="location" maxLength="120" placeholder="e.g. Bellville, Cape Town"/></label></div><label>Item photo<input required name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif"/></label><label>Description<textarea name="description" required maxLength="2000" rows="3" placeholder="Describe the item honestly..."/></label><p className="form-note"><Camera size={15}/> Choose a JPG, PNG, WEBP, or GIF image (up to 5 MB).</p><button className="button button-primary full-button">Publish listing <ArrowRight size={16}/></button></form></Modal>}

    {checkoutOpen&&<Modal title="Checkout" subtitle="Review your order before placing it." onClose={()=>setCheckoutOpen(false)}><form className="form-stack" onSubmit={checkout}><div className="checkout-lines">{cart.map(i=><div key={i.id}><span>{i.title} × {i.qty}</span><b>{money(i.price*i.qty)}</b></div>)}</div><div className="checkout-total"><span>Order subtotal</span><b>{money(cartTotal)}</b></div><label>Collection option<select name="delivery"><option>Arrange collection with seller</option><option>Discuss local delivery with seller</option></select></label><label>Order note (optional)<textarea name="note" rows="2" maxLength="1000" placeholder="Any details for the seller?"/></label><div className="payment-notice"><ShieldCheck size={18}/><span><b>Arrange payment with the seller</b><small>Online payments are not connected. Your order will be saved to your account.</small></span></div><button className="button button-primary full-button">Place order <ArrowRight size={16}/></button></form></Modal>}

    {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
  </div>
}

function ProductCard({product:p,wished,onOpen,onWish,onAdd}) {
  return <article className="product-card"><button className="product-image" onClick={onOpen} aria-label={`View ${p.title}`}><img src={p.image} alt={p.title} loading="lazy"/>{p.badge&&<span className="product-badge">{p.badge}</span>}<span className="condition-pill">{p.condition}</span></button><button className={`wish-button ${wished?'wished':''}`} onClick={onWish} aria-label={wished?'Remove from saved':'Save item'}><Heart size={17} fill={wished?'currentColor':'none'}/></button><div className="product-content"><button className="product-title" onClick={onOpen}>{p.title}</button><div className="product-meta"><span>{p.category}</span><span><MapPin size={12}/>{p.location.split(',')[0]}</span></div><div className="product-bottom"><div><strong>{money(p.price)}</strong>{p.oldPrice&&<del>{money(p.oldPrice)}</del>}</div><button className="quick-add" onClick={onAdd} aria-label="Add to bag"><Plus size={18}/></button></div><div className="seller-meta"><span className="avatar avatar-small">{p.initials}</span><span>{p.seller}</span><span className="seller-rating"><Star size={12} fill="currentColor"/>{p.rating}</span></div></div></article>
}
function Stat({label,value,icon:Icon}) { return <div className="stat-card"><span className="stat-icon"><Icon size={20}/></span><span className="stat-value">{value}</span><span className="stat-label">{label}</span></div> }
function Modal({title,subtitle,children,onClose,wide=false}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true"><div className="modal-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>{children}</section></div> }

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
