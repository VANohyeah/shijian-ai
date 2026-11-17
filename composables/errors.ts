
export function describeError(err: unknown, action: string): string {
  const isResponse = typeof Response !== 'undefined' && err instanceof Response

  if (!isResponse) {

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return offline
      ? `网络断开了。连上再试一次，${action}还能接着来。`
      : `${action}没成，像是没连上服务。再试一次？`
  }

  const code = err.status
  if (code === 401 || code === 403) return `服务端不认这次请求，${action}没成。这事得让维护的人看一眼。`
  if (code === 404) return `要找的东西不在了，${action}做不下去。`
  if (code === 413) return '这张图太沉了，传不上去。换张小点的，或者重新截一次。'
  if (code === 429) return '问得太急了，歇一分钟再来。'
  if (code >= 500) return `我们这边出了点岔子，不是你操作的问题。等半分钟再试，${action}不会白费。`
  return `${action}没成（${code}）。再试一次？`
}
