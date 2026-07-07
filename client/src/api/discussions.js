import api from './client';

export const listPosts = (courseId, lessonId) =>
  api.get(`/courses/${courseId}/lessons/${lessonId}/discussions`);

export const createPost = (courseId, lessonId, data) =>
  api.post(`/courses/${courseId}/lessons/${lessonId}/discussions`, data);

export const deletePost = (courseId, lessonId, postId) =>
  api.delete(`/courses/${courseId}/lessons/${lessonId}/discussions/${postId}`);
