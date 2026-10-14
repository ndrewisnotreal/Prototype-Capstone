<template>
  <!-- Bentuk sama dengan ProductCard supaya tata letak tidak meloncat saat data masuk -->
  <div
    aria-hidden="true"
    class="flex flex-col overflow-hidden rounded-card border border-gray-200 bg-white"
  >
    <Skeleton class="aspect-square h-auto!" border-radius="0" />
    <div class="flex flex-col gap-2.5 p-4">
      <Skeleton width="40%" height="12px" />
      <Skeleton width="85%" height="16px" />
      <Skeleton width="55%" height="12px" />
      <Skeleton width="50%" height="20px" class="mt-2" />
    </div>
  </div>
</template>
