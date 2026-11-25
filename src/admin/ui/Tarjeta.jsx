// Superficie porcelana con borde fino y sombra muy suave.
export default function Tarjeta({ como: Elemento = 'div', className = '', children, ...props }) {
  return (
    <Elemento className={`ui-tarjeta ${className}`.trim()} {...props}>
      {children}
    </Elemento>
  )
}
