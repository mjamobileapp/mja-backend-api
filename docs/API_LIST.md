# API List

Base URL default project: `http://localhost:9090`

Sebagian besar endpoint memakai header:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Endpoint `POST /login` tidak memakai token. Endpoint upload memakai `multipart/form-data` dengan field file bernama `files`.

## Auth

| Method | URL | Body request |
| --- | --- | --- |
| POST | `/login` | `{"username":"admin","password":"password"}` |

## Users

| Method | URL | Body request |
| --- | --- | --- |
| GET | `/users` | - |
| GET | `/users/:id` | - |
| POST | `/users` | `{"nama":"Admin User","roleId":1,"username":"admin","password":"password","createdBy":"system"}` |
| PUT | `/users/:id` | `{"nama":"Admin User","roleId":1,"username":"admin","password":"new-password","createdBy":"system"}` |
| DELETE | `/users/:id` | - |

## Roles

| Method | URL | Body request |
| --- | --- | --- |
| GET | `/roles` | - |
| GET | `/roles/:idRole` | - |
| POST | `/roles` | `{"namaRole":"Admin","description":"Administrator","createdBy":"system"}` |
| PUT | `/roles/:idRole` | `{"namaRole":"Admin","description":"Administrator updated","createdBy":"system"}` |
| DELETE | `/roles/:idRole` | - |

## Menus

| Method | URL | Body request |
| --- | --- | --- |
| GET | `/menus` | - |
| GET | `/menus/:id` | - |
| POST | `/menus` | `{"url":"/dashboard","namaMenu":"Dashboard","parentId":null,"menuParent":null,"menuSubParent":null,"iconMenu":"LayoutDashboard","levelMenu":1,"tipeMenu":"Header","noUrut":1,"createdBy":"system"}` |
| PUT | `/menus/:id` | `{"url":"/dashboard","namaMenu":"Dashboard","parentId":null,"menuParent":null,"menuSubParent":null,"iconMenu":"LayoutDashboard","levelMenu":1,"tipeMenu":"Header","noUrut":1,"createdBy":"system"}` |
| DELETE | `/menus/:id` | - |

## Dashboard & Utility

| Method | URL | Body request |
| --- | --- | --- |
| GET | `/` | - |
| GET | `/akses/role/:idRole` | - |
| POST | `/akses/role/:idRole` | `[{"id":1,"name":"Dashboard","checked":true,"children":[{"id":2,"name":"Project","checked":true}]}]` |
| GET | `/akses/user/:email` | - |
