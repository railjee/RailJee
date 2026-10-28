// Only allow same-site paths as post-login redirects, so ?redirect= can't send users to another site.
export function getSafeRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/'
  }
  return value
}
