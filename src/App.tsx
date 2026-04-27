import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useColorScheme } from './contexts/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { useAppState } from './hooks/useAppState'
import { AppWrapper, MainContent, AppSnackbar, AppAlert } from './App.styles'

import Header from './components/Header'
import AddProductModal from './components/AddProductModal'
import ConfirmDialog from './components/ConfirmDialog'
import BottomNav from './components/BottomNav'
import PantryView from './views/PantryView'
import ShoppingView from './views/ShoppingView'
import AboutView from './views/AboutView'

export default function App() {
  const { muiTheme } = useColorScheme()
  const app = useAppState()

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AuthProvider>
      <AppWrapper>
        <Header
          onAddClick={app.openAddModal}
          searchQuery={app.searchQuery}
          onSearchChange={app.setSearchQuery}
          onAboutClick={() =>
            app.handleViewChange(app.currentView === 'about' ? 'pantry' : 'about')
          }
          currentView={app.currentView}
          onViewChange={app.handleViewChange}
        />

        <MainContent>
          {app.currentView === 'pantry' && (
            <PantryView
              products={app.products}
              sortConfig={app.sortConfig}
              onSort={app.handleSort}
              onDelete={app.handleDeleteProduct}
              onEdit={app.openEditModal}
              onAddToCart={app.handleAddToCart}
              onAddClick={app.openAddModal}
              onQuantityChange={app.handleQuantityChange}
            />
          )}
          {app.currentView === 'shopping' && (
            <ShoppingView
              items={app.shoppingList}
              onAddClick={() => app.setAddModal({ open: true, context: 'shopping' })}
              onToggle={app.handleTogglePurchased}
              onDelete={app.handleDeleteShoppingItem}
              onEdit={app.openEditModal}
              onClearPurchased={app.handleClearPurchased}
              onQuantityChange={app.handleShoppingQuantityChange}
            />
          )}
          {app.currentView === 'about' && <AboutView />}
        </MainContent>

        <BottomNav
          value={app.bottomNavValue}
          onChange={(v) => app.handleViewChange(v === 1 ? 'shopping' : 'pantry')}
        />

        <AddProductModal
          open={app.addModal.open}
          context={app.addModal.context}
          onAccept={
            app.addModal.context === 'shopping'
              ? app.handleAddShoppingItem
              : app.handleAddPantryProduct
          }
          onCancel={app.handleCancelAdd}
        />

        <AddProductModal
          open={app.editModal.open}
          context={app.editModal.context}
          initialData={app.editModal.initialData ?? undefined}
          onAccept={
            app.editModal.context === 'shopping'
              ? app.handleEditShoppingItem
              : app.handleEditProduct
          }
          onCancel={app.handleCancelEdit}
        />

        <ConfirmDialog
          open={app.confirmDialog.open}
          type={app.confirmDialog.type}
          data={app.confirmDialog.data}
          onClose={app.closeConfirmDialog}
        />

        <AppSnackbar
          open={app.snackbar.open}
          autoHideDuration={2500}
          onClose={app.closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <AppAlert severity="success" variant="filled" onClose={app.closeSnackbar}>
            {app.snackbar.message}
          </AppAlert>
        </AppSnackbar>
      </AppWrapper>
      </AuthProvider>
    </ThemeProvider>
  )
}
