import Pie from '../components/Pie'

export default function NoEncontrado() {
  return (
    <>
      <main className="contenedor">
        <h1>Local no encontrado</h1>
        <p>No encontramos el menú que buscás. Revisá que el link o el QR sean correctos.</p>
      </main>
      <Pie />
    </>
  )
}
