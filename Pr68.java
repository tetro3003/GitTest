import java.awt.event.ActionEvent;

import javax.swing.*;

import acm.graphics.GLabel;
import acm.program.GraphicsProgram;
//68. თქვენი ამოცანაა გრაფიკული პროგრამის საშუალებით გააკეთოთ ჩატი. ფანჯარაზე, SOUTH
//რეგიონზე უნდა გქონდეთ ერთი ტექსტფილდი და ერთი ღილაკი ტექტით Enter.
//ტექსტფილდში ტექსტის შეყვანის მერე Enter ჭილაკზე დაჭერით ტექსტი უნდა
//იწერებოდეს(იხატებოდეს) კანვასზე ხოლო ტექსტფილდში კი ტექსტი იშლებოდეს. ხელახლა
//ტექსტის შეყვანისას ახალი ტექსტი წინა ტექსტის ქვემოთ უნდა გამოცნდეს(როგორც ჩატში
//ხდება ხოლმე. თუკი ტექსტი ჩაცდება ეკრანს არაუშავს.
//69. 68 ამოცანის გაგრძელება. დაამატეთ სქროლი. თუკი ტექსტი ჩაცდება ეკრანს მაშინ ახალი
//ტექსტი მაინც უნდა გამოჩნდეს ეკრანის ბოლოში, შესაბამისად სულ პირველად შეყვანილი
//ტექსტი გაქრება ეკრანიდან. 
public class Problem68 extends GraphicsProgram {
	private static final int DISTANCE = 40;
	private JTextField textField;
	private JButton button;
	private double x = DISTANCE;
	private double y = DISTANCE;
	
	public void init() {
		textField = new JTextField(20);
		add(textField, SOUTH);
		textField.addActionListener(this);

		
		button = new JButton("Enter");
		add(button, SOUTH);
		
		
		addActionListeners();
		
	}

	public void run() {

	}

	@Override
	public void actionPerformed(ActionEvent e) {
		println("here");
		if(e.getSource() == textField || e.getSource() == button) {
			String text = textField.getText();
			println(text);
			displayMessage(text);
			textField.setText("");
		}
	}
	
	private void displayMessage(String text) {
		if(text == null || text.equals("")) {
			return;
		}
		GLabel message = new GLabel(text);
		add(message, x, y);
		y += DISTANCE;
	}
}
