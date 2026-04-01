import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/WatcherView.vue'),
    },
    {
      path: '/track',
      name: 'track',
      component: () => import('./views/TrackView.vue'),
    },
    {
      path: '/compare',
      name: 'compare',
      component: () => import('./views/CompareView.vue'),
    },
  ],
});

export default router;