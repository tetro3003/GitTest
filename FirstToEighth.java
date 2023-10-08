import stanford.karel.SuperKarel;
import stanford.karel.*;

public class FirstToEighth extends SuperKarel {

	@Override
	public void run(){
	
		fourth();
	
	}
	
	
	private void first(){
		
		move();
		move();
		pickBeeper();
		move();
		putBeeper();
	 
		// run-ში გამოვიძახებთ მეთოდს first()
		
	}


	private void second(){
	
	for(int i=0; i<4; i++){
		
		move();
		
	} //მივა ბიპერებამდე, მეთოდს დავარმევდი moveToBeepers()
	
	for(int i=0; i<10; i++){
		
		pickBeeper();
		
	} //აიღებს იმ 10 ცალ ბიპერს, მეთოდს დავარქმევდი pickTenBeepers()
	
	move();
	
	for(int j=0; j<10; j++){
		
		putBeeper();
		
	} //დადებს იმ 10 ცალ ბიპერს, მეთოდს დავარქმევდი putTenBeepers()
	
	
	// run-ში გამოვიძახებთ მეთოდს second()
	
	}
	
	private void third(){
		
		while(frontIsClear()){
			move();
		}
	 
		// run-ში გამოვიძახებთ მეთოდს third()
		
	}
	
	private void fourth(){
		
		putBeeper();
		
		while(frontIsClear()){
			move();
			putBeeper();
		}
	 
		// run-ში გამოვიძახებთ მეთოდს fourth()
		
	}

}