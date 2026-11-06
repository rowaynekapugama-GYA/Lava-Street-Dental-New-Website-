export function Logo() {
  return (
    <span className="tnc-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/images/logo.svg" alt="Lava Street Dental" height={44} />
    </span>
  )
}

export function Icon() {
  return (
    <span className="tnc-logo tnc-logo--icon">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/images/logo.svg" alt="" height={26} />
    </span>
  )
}

export default Logo
