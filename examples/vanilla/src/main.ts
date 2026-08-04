const html = String.raw

// eslint-disable-next-line @masknet/no-top-level, @masknet/browser-no-set-html
document.querySelector<HTMLDivElement>('#root')!.innerHTML = html`
  <h1>see /three-mmd or /three-stdlib</h1>
`
