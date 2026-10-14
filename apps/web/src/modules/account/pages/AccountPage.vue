<script setup lang="ts">
import AccountNav from '../components/AccountNav.vue'

// Menu akun customer untuk tombol "Akun" di tab bar ponsel (desktop memakai AccountNav di samping Pesanan dan Profil).
// Belum ada layar desain khusus; AccountNav dari layar Pesanan/Profil dipakai utuh.
</script>

<template>
  <div class="mx-auto w-full max-w-[480px] px-4 pt-5 pb-10 sm:px-6 lg:pt-8">
    <h1 class="sr-only">Akun</h1>
    <AccountNav />
  </div>
</template>
