import '@testing-library/jest-dom/vitest'

if (typeof Element !== 'undefined' && !('scrollTo' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'scrollTo', {
    configurable: true,
    value: () => {},
    writable: true,
  })
}
