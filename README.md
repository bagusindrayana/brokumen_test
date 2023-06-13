# :fist: Brokumen
## :pencil: Ngobrol bareng dokumen

dalam aplikasi ini kalian dapat mengupload dokumen kalian (pdf) dan mengobrol dan chatting dengan isi dokumen tersebut.
aplikasi ini di dukung dengan AI dari OpenAi sehingga memungkinkan kalian untuk bertanya perihal yang ada di dalam dokumen tersebut.

### :art: Demo
https://brokumen.up.railway.app

repo ini di khusukan hanya untuk demo jadi bisa saja kedepannya fitur-fitur yang ada di repo ini berbeda dengan yang ada di demo


### :computer: Tech Stack
- NextJs
- Tailwind
- Cloudflare R2 (untuk object storage)
- Pinecone (untuk vector database)
- Railway App (untuk deploy)

### :books: Library lainnya
- Langchain Js
- OpenAi
- Daisy UI
- React Icons
- formidable
- dotenv
- react-pdf

### :gun: Cara menjalankan Di Lokal
<p>untuk menjalankan aplikasi ini kalian perlu api dari :</p>

- OpenAi (untuk gpt-3.5-turbo dan ada-002 emmbeding)
- Cloudflare R2 (untuk object storage)
- Pinecone (untuk vector database) 

<p>Kemudian :</p>

- clone repo ini
- copy file .env.example dan rename menjadi .env
- isi semua kredeensial yang ada di .env
- jalankan `npm install`
- jalankan `npm run dev`

### :telescope: Cara kerja aplikasi
- saat mengupload dokumen, file akan di simpan di cloudflare R2
- kemudian file pdf tersebut akan di ekstraks menggunakan langchain
- hasil ekstrak tersebut akan diubah menjadi embedding menggunakan open ai ada-002 dan di ubah menjadi bentuk vector database dan di simpan di pinecone
- saat mengirm query pertanyaan atau pesan, query tersebut juga akan diubah menjadi embedding menggunakan open ai ada-002
- hasil embedding dari query pertanyaan akan di gunakan untuk mencari jawaban di dalam database vector
- setelah mendapatkan hasil dari vector database, hasil tersebut akan di kirim lagi ke gpt-3.5-turbo untuk di proses menjadi kalimat yang mudah dibaca

### :warning: Batasan/limitasi
- hanya bisa mengupload file pdf
- file pdf hasil scan dokumen/gambar tidak bisa di gunakan karena tidak bisa di ekstrak textnya (tidak searchable) , bisa di atasi dengan menggunakan OCR
- kemungkin dokumen dengan jumlah baris yang banyak akan mengalami error saat di ekstrak
- dan repo ini masih berantakan dan belum di refaktor kodenya

### :love_letter: Dukungan & Donasi
- silahkan berikan bintang jika kalian suka dengan project ini
- web demo saat ini menggunakan akun dari api pribadi saya silahkan donasi, jika ingin web demo tersebut terus berjalan

<a href="https://trakteer.id/bagood/tip" target="_blank"><img id="wse-buttons-preview" src="https://cdn.trakteer.id/images/embed/trbtn-red-1.png" height="40" style="border:0px;height:40px;" alt="Trakteer Saya"></a>


### :page_with_curl: Lisensi
MIT 
- semua kode di repo ini bebas untuk di gunakan dan di modifikasi tapi jika ada error atau bug saya tidak menjamin ada waktu untuk membantu
- jika ingin di deploy dan digunakan secara pribadi ataupun komersil silahkan dan mohon untuk merubah desain serta nama aplikasi
