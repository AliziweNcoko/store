import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const supabaseConfigError = !supabase
  ? 'Add your Supabase project URL and anon key to .env, then restart the app.'
  : ''

export const unwrap = result => {
  if (result.error) throw result.error
  return result.data
}

export const mapProduct = product => ({
  ...product,
  oldPrice: product.old_price,
  ownerId: product.owner_id,
  createdAt: product.created_at
})

export const mapUser = authUser => {
  const name = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Community member'
  const role = authUser.app_metadata?.role === 'Administrator'
    ? 'Administrator'
    : ['Student', 'Faculty', 'Local Vendor', 'Resident'].includes(authUser.user_metadata?.role)
      ? authUser.user_metadata.role
      : 'Student'
  return {
    id: authUser.id,
    name,
    email: authUser.email || '',
    role,
    initials: name.split(/[\s@]+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
  }
}
