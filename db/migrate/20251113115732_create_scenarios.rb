class CreateScenarios < ActiveRecord::Migration[8.1]
  def change
    create_table :scenarios do |t|
      t.string :name
      t.text :description

      t.timestamps
    end
  end
end
