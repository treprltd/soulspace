import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Implicit flow avoids PKCE code-verifier cookie loss caused by
        // Chrome's bounce-tracking protection deleting cookies during the
        // Supabase redirect chain (app → supabase.co → app).
        flowType: 'implicit',
      },
    }
  )
}
