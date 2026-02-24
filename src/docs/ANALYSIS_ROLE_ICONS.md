
# Analysis: Role-Based Icon and Color Definitions

This document provides a comprehensive analysis of how user roles are styled, mapped, and displayed across the application, specifically focusing on `Header.jsx` and `ProfileTypeSubtitle.jsx`.

## 1. Role Mappings & Styling Definitions

The application currently handles four primary roles: `free`, `client`, `coach`, and `admin`. The visual representation of these roles is split between the top navigation (`Header.jsx`) and the user's profile view (`ProfileTypeSubtitle.jsx`).

### Profile View (`src/components/profile/ProfileTypeSubtitle.jsx`)
This component acts as the main source of truth for rich role badges.

| Role | Label | Colors (Tailwind Classes) | Icon (Lucide) |
| :--- | :--- | :--- | :--- |
| **free** | Plan Gratuito | `bg-gradient-to-r from-slate-600/95 to-slate-500/30 text-white border-slate-400` | `User` |
| **client** | Pro | `bg-gradient-to-r from-amber-600/95 to-yellow-500/30 text-black border-yellow-400` | `Crown` |
| **coach** | Entrenador | `bg-gradient-to-r from-emerald-700/95 to-emerald-500/30 text-white border-emerald-400` | `ShieldCheck` |
| **admin** | Administrador | `bg-gradient-to-r from-red-700/95 to-rose-600/30 text-white border-red-500` | `Star` |

* **Logic Flow**: The component receives a `role` prop (defaulting to `'free'`). It normalizes the role to lowercase and looks it up in a `typeConfig` dictionary. If no match is found, it falls back to the `free` configuration. It renders a `Badge` component containing the mapped Icon and Label.

### Header Navigation (`src/components/Header.jsx`)
The header uses a simpler, hardcoded conditional approach for displaying the user's avatar and role text.

| Role | Display Name | Avatar Colors | Avatar Icon |
| :--- | :--- | :--- | :--- |
| **coach** | Coach | `bg-amber-500/20 text-amber-500 border border-amber-500/30` | `User` |
| **admin** | Admin | `bg-[#5ebe7d] text-white` (Default Green) | `User` |
| **client/free**| Cliente | `bg-[#5ebe7d] text-white` (Default Green) | `User` |

* **Logic Flow**:
  1. Retrieves user context: `const { user } = useAuth();`
  2. Evaluates boolean flags: `const isAdmin = user?.role === 'admin';` and `const isCoach = user?.role === 'coach';`
  3. Uses a switch statement in `getRoleDisplayName(role)` to output plain text ("Admin", "Coach", "Cliente").
  4. Conditionally renders the avatar color using a ternary operator: `${isCoach ? 'bg-amber-500/20 text-amber-500...' : 'bg-[#5ebe7d] text-white'}`. *Note: Admins and Clients currently share the same green styling for the avatar in the header.*
  5. The `<User className="w-4 h-4" />` icon is statically used inside the avatar circle regardless of the role.

## 2. Navigational Icons Based on Role

In `src/components/Header.jsx`, access to certain links and their accompanying icons are gated by role:

* **Staff (Admin & Coach)**:
  * Contenidos: `<Shield />`
  * Recordatorios: `<StickyNote />`
  * Calendario: `<Calendar />`
* **Clients / Free Users**:
  * Mi Plan: `<BookOpen />`
* **Universal**:
  * Lista de la Compra: `<ShoppingCart />`
  * Mi Perfil: `<User />`

## 3. General App Icon Configuration
* **File**: `src/constants/appIcons.js`
* **Usage**: Centralized configuration for the primary application logo/icon.
* **Content**: Exports `APP_ICON_CONFIG` containing the `AppIcon` component and a default style string (`"w-6 h-6 text-green-400"`).

## 4. Summary & Recommendations for Modification

### Current Architecture
Currently, role styling is **decentralized**. `ProfileTypeSubtitle.jsx` uses a robust configuration object, while `Header.jsx` uses inline ternary operators and switch statements.

### How to Modify Colors and Icons
1. **To change the Profile Badges**:
   Navigate to `src/components/profile/ProfileTypeSubtitle.jsx` and modify the `typeConfig` object. Change the `className` string for colors or import a different icon from `lucide-react`.
2. **To change the Header Avatar**:
   Navigate to `src/components/Header.jsx` (around line 94). Modify the ternary operator to include distinct styles for `admin` if desired, or replace the `<User>` icon with dynamic icons based on the role.

### Future Improvement (Refactoring)
To ensure UI consistency across the application, it is recommended to extract the role configuration from `ProfileTypeSubtitle.jsx` into a centralized constant file (e.g., `src/constants/roleConfig.js`). Both `Header.jsx` and `ProfileTypeSubtitle.jsx` could then import and consume this single source of truth for labels, colors, and icons.
