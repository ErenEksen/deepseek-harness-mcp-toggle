/** CSS Modules: a stylesheet import resolves to its hashed class map. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
