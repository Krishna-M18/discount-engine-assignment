
import { useRef } from 'react'

export default function PdfUploader({
  onLoad,
  hasData,
  fileName,
}) {
  const inputRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]

    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file.')
      e.target.value = ''
      return
    }

    onLoad(file)
    e.target.value = ''
  }

  return (
    <div
      style={{
        border: `2px dashed ${hasData ? '#1e5c2c' : '#CECECE'}`,
        borderRadius: 6,
        padding: '1rem 1.2rem',
        background: hasData ? '#f0faf2' : '#fafafa',
        cursor: 'pointer',
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <span style={{ fontSize: 20 }}>
          {hasData ? '✅' : '📄'}
        </span>

        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: '#131A48',
            }}
          >
            Cart PDF
          </div>

          <div
            style={{
              fontSize: 11,
              color: '#888',
              marginTop: 2,
            }}
          >
            {hasData ? fileName : 'Upload a cart PDF'}
          </div>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: hasData ? '#1e5c2c' : '#FF5800',
              textTransform: 'uppercase',
            }}
          >
            {hasData ? 'Change' : 'Upload'}
          </span>
        </div>
      </div>
    </div>
  )
}
