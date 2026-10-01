/** Avoid invalidating layout and paint when pooled DOM content is unchanged. */
export function setText(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text
}

const styleValues = new WeakMap<HTMLElement, Map<string, string>>()

export function setStyle<K extends 'left' | 'right' | 'top' | 'width' | 'font' | 'lineHeight' | 'letterSpacing' | 'flexDirection' | 'position' | 'color' | 'pointerEvents' | 'whiteSpace' | 'textAlign'>(
  element: HTMLElement,
  property: K,
  value: CSSStyleDeclaration[K],
) {
  let values = styleValues.get(element)
  if (!values) {
    values = new Map()
    styleValues.set(element, values)
  }
  // CSS may normalize font strings; compare the requested value instead.
  if (values.get(property) === value) return
  values.set(property, value)
  element.style[property] = value
}
